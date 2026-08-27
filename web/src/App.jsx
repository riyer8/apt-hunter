import { Navigate, Route, Routes } from "react-router-dom";
import { ApartmentProvider } from "./state/ApartmentContext.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ApartmentDetail from "./pages/ApartmentDetail.jsx";
import Changes from "./pages/Changes.jsx";

export default function App() {
  return (
    <ApartmentProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/changes" element={<Changes />} />
        <Route path="/apartments/:id" element={<ApartmentDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ApartmentProvider>
  );
}
