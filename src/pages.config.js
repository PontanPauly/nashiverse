import Birthdays from './pages/Birthdays';
import Calendar from './pages/Calendar';
import Family from './pages/Family';
import FamilyStories from './pages/FamilyStories';
import Home from './pages/Home';
import LoveNotes from './pages/LoveNotes';
import Messages from './pages/Messages';
import Moments from './pages/Moments';
import Profile from './pages/Profile';
import Rituals from './pages/Rituals';
import Settings from './pages/Settings';
import TripDetail from './pages/TripDetail';
import Trips from './pages/Trips';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Birthdays": Birthdays,
    "Calendar": Calendar,
    "Family": Family,
    "FamilyStories": FamilyStories,
    "Home": Home,
    "LoveNotes": LoveNotes,
    "Messages": Messages,
    "Moments": Moments,
    "Profile": Profile,
    "Rituals": Rituals,
    "Settings": Settings,
    "TripDetail": TripDetail,
    "Trips": Trips,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};