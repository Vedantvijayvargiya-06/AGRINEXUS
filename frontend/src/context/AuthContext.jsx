import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const DEMO_PROFILES = [
  {
    id: 1,
    name: "Ramesh Kumar",
    phone: "9876543210",
    email: "ramesh.farmer@agrinexus.org",
    role: "farmer",
    fpo_id: "FPO-KOLAR-01",
    locality: "Kolar, Karnataka",
    badge: "Farmer",
    avatar: "👨‍🌾"
  },
  {
    id: 4,
    name: "Rajesh Sharma (FPO Admin)",
    phone: "9876543299",
    email: "admin@kisankalyan.org",
    role: "fpo_admin",
    fpo_id: "FPO-KOLAR-01",
    locality: "Kolar Regional Office",
    badge: "FPO Admin",
    avatar: "🏢"
  },
  {
    id: 5,
    name: "AgroFresh Foods",
    phone: "9876543300",
    email: "procurement@agrofresh.in",
    role: "buyer",
    fpo_id: "BUYER-CORP-99",
    locality: "Bengaluru Hub",
    badge: "Procurement Buyer",
    avatar: "🛒"
  },
  {
    id: 6,
    name: "System Administrator",
    phone: "9876543399",
    email: "superadmin@agrinexus.gov.in",
    role: "admin",
    fpo_id: "HQ-01",
    locality: "National Center",
    badge: "System Admin",
    avatar: "⚙️"
  }
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('agrinexus_user');
    return saved ? JSON.parse(saved) : DEMO_PROFILES[0];
  });

  const switchRole = (roleKey) => {
    const target = DEMO_PROFILES.find(p => p.role === roleKey) || DEMO_PROFILES[0];
    setCurrentUser(target);
    localStorage.setItem('agrinexus_user', JSON.stringify(target));
  };

  const loginAsUser = (userObj) => {
    setCurrentUser(userObj);
    localStorage.setItem('agrinexus_user', JSON.stringify(userObj));
  };

  return (
    <AuthContext.Provider value={{ currentUser, switchRole, loginAsUser, demoProfiles: DEMO_PROFILES }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
