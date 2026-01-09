import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        // Navigation tracking placeholder
        // Can be replaced with custom analytics if needed
    }, [location]);

    return null;
}
