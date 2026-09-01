import { Navigate, Route, Routes } from "react-router-dom";
import { ApartmentProvider } from "./state/ApartmentContext.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Browse from "./pages/Browse.jsx";
import ApartmentDetail from "./pages/ApartmentDetail.jsx";
import Changes from "./pages/Changes.jsx";
import Preferences from "./pages/Preferences.jsx";

export default function App() {
  return (
    <ApartmentProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/changes" element={<Changes />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/apartments/:id" element={<ApartmentDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ApartmentProvider>
  );
}
