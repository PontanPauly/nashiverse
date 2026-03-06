import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, DollarSign, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function BudgetManager({ tripId, people }) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => base44.entities.Expense.filter({ trip_id: tripId }),
  });

  const deleteExpense = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['expenses', tripId]),
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const balances = React.useMemo(() => {
    const balance = {};
    people.forEach(p => balance[p.id] = 0);

    expenses.forEach(expense => {
      balance[expense.paid_by_person_id] = (balance[expense.paid_by_person_id] || 0) + expense.amount;

      const splitIds = expense.split_among_ids || [expense.paid_by_person_id];
      const splitCount = splitIds.length || 1;
      const perPerson = expense.amount / splitCount;
      splitIds.forEach(personId => {
        balance[personId] = (balance[personId] || 0) - perPerson;
      });
    });

    return balance;
  }, [expenses, people]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Budget</h3>
          <p className="text-2xl font-bold text-amber-400">${totalExpenses.toFixed(2)}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        <h4 className="text-sm font-semibold text-slate-400 mb-3">Balances</h4>
        <div className="space-y-2">
          {people.map(person => {
            const bal = balances[person.id] || 0;
            return (
              <div key={person.id} className="flex justify-between items-center">
                <span className="text-slate-300">{person.name}</span>
                <span className={bal > 0 ? 'text-green-400' : bal < 0 ? 'text-red-400' : 'text-slate-500'}>
                  {bal > 0 ? '+' : ''}{bal.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {expenses.map(expense => {
          const paidBy = people.find(p => p.id === expense.paid_by_person_id);
          return (
            <div key={expense.id} className="glass-card rounded-lg p-4 flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-medium text-slate-200">{expense.description}</h4>
                <div className="flex gap-2 mt-1 text-sm text-slate-500">
                  <span>{paidBy?.name || 'Unknown'}</span>
                  {expense.date && (
                    <>
                      <span>•</span>
                      <span>{format(new Date(expense.date), 'MMM d')}</span>
                    </>
                  )}
                  {expense.category && <Badge className="ml-2">{expense.category}</Badge>}
                </div>
                {expense.split_among_ids && expense.split_among_ids.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Split among {expense.split_among_ids.length} {expense.split_among_ids.length === 1 ? 'person' : 'people'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-amber-400">${expense.amount}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingExpense(expense);
                    setShowForm(true);
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteExpense.mutate(expense.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <ExpenseForm
          tripId={tripId}
          people={people}
          expense={editingExpense}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingExpense(null);
            queryClient.invalidateQueries(['expenses', tripId]);
          }}
        />
      )}
    </div>
  );
}

function ExpenseForm({ tripId, people, expense, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    description: expense?.description || '',
    amount: expense?.amount || '',
    paid_by_person_id: expense?.paid_by_person_id || '',
    split_among_ids: expense?.split_among_ids || people.map(p => p.id),
    category: expense?.category || 'other',
    date: expense?.date || new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      trip_id: tripId,
      description: formData.description,
      amount: parseFloat(formData.amount),
      paid_by_person_id: formData.paid_by_person_id,
      split_among_ids: formData.split_among_ids,
      category: formData.category,
      date: formData.date || null,
    };
    
    if (expense?.id) {
      await base44.entities.Expense.update(expense.id, dataToSave);
    } else {
      await base44.entities.Expense.create(dataToSave);
    }
    onSuccess();
  };

  const toggleSplit = (personId) => {
    const current = formData.split_among_ids;
    if (current.includes(personId)) {
      setFormData({ ...formData, split_among_ids: current.filter(id => id !== personId) });
    } else {
      setFormData({ ...formData, split_among_ids: [...current, personId] });
    }
  };

  const perPerson = formData.split_among_ids.length > 0 && formData.amount
    ? (parseFloat(formData.amount) / formData.split_among_ids.length).toFixed(2)
    : '0.00';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div>
              <Label className="text-slate-300">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Category</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="lodging">Lodging</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
                <SelectItem value="activities">Activities</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300">Paid By</Label>
            <Select value={formData.paid_by_person_id} onValueChange={(val) => setFormData({ ...formData, paid_by_person_id: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300">Split Among</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {people.map(person => (
                <Badge
                  key={person.id}
                  onClick={() => toggleSplit(person.id)}
                  className={`cursor-pointer ${
                    formData.split_among_ids.includes(person.id)
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                  }`}
                >
                  {person.name}
                </Badge>
              ))}
            </div>
            {formData.split_among_ids.length > 0 && formData.amount && (
              <p className="text-xs text-slate-500 mt-2">
                ${perPerson} each ({formData.split_among_ids.length} {formData.split_among_ids.length === 1 ? 'person' : 'people'})
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              {expense ? 'Update Expense' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
