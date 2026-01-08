import Home from './pages/Home';
import Family from './pages/Family';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Family": Family,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};