import Family from './pages/Family';
import Home from './pages/Home';
import LoveNotes from './pages/LoveNotes';
import Moments from './pages/Moments';
import Settings from './pages/Settings';
import TripDetail from './pages/TripDetail';
import Trips from './pages/Trips';
import Rituals from './pages/Rituals';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Family": Family,
    "Home": Home,
    "LoveNotes": LoveNotes,
    "Moments": Moments,
    "Settings": Settings,
    "TripDetail": TripDetail,
    "Trips": Trips,
    "Rituals": Rituals,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};