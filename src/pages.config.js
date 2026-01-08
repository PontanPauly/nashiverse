import Family from './pages/Family';
import Home from './pages/Home';
import LoveNotes from './pages/LoveNotes';
import Moments from './pages/Moments';
import Rituals from './pages/Rituals';
import Settings from './pages/Settings';
import TripDetail from './pages/TripDetail';
import Trips from './pages/Trips';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Family": Family,
    "Home": Home,
    "LoveNotes": LoveNotes,
    "Moments": Moments,
    "Rituals": Rituals,
    "Settings": Settings,
    "TripDetail": TripDetail,
    "Trips": Trips,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};