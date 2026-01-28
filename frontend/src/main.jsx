import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./AuthContext";
import ProtectedRoute from "./ProtectedRoute";

import AppLayout from "./layouts/AppLayout";
import PublicLayout from "./layouts/PublicLayout";

import Landing from "./pages/Landing"; // or PublicHome
import Login from "./pages/Login";
import Register from "./pages/Register";

import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Trucks from "./pages/Trucks";
import Inventory from "./pages/Inventory";
import Maintenance from "./pages/Maintenance";
import Orders from "./pages/Orders";
import DriverHome from "./pages/DriverHome";
import DriverJobs from "./pages/DriverJobs";
import EditProfile from "./pages/EditProfile";
import CreateDriver from "./pages/CreateDriver";
import OrderCreate from "./pages/OrderCreate";
import OrderDetail from "./pages/OrderDetail";
import TripDetail from "./pages/TripDetail";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* 🌍 PUBLIC WEBSITE */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            {/* 🔓 AUTH PAGES (ERP LOGIN) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* 🔐 ERP SYSTEM */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/trucks" element={<Trucks />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderCreate />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/drivers/new" element={<CreateDriver />} />
            <Route path="/trips/:id" element={<TripDetail />} />

            {/* Driver */}
            <Route path="/driver" element={<DriverHome />} />
            <Route path="/driver/jobs" element={<DriverJobs />} />
            <Route path="/profile" element={<EditProfile />} />
          </Route>

          {/* ❌ Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
