import Home from './pages/Home';
import Family from './pages/Family';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Family": Family,
    "Trips": Trips,
    "TripDetail": TripDetail,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};