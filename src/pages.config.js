import Home from './pages/Home';
import Family from './pages/Family';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import Rituals from './pages/Rituals';
import Moments from './pages/Moments';
import LoveNotes from './pages/LoveNotes';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Family": Family,
    "Trips": Trips,
    "TripDetail": TripDetail,
    "Rituals": Rituals,
    "Moments": Moments,
    "LoveNotes": LoveNotes,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};