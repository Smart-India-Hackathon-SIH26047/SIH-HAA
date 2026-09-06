import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const TEST_VICTIMS = [
  { id: "P101", name: "Ramesh Kumar", district: "Patna Division", caseRef: "FIR-2024-8842" },
  { id: "P102", name: "Sunita Devi", district: "Gaya Division", caseRef: "FIR-2024-9104" },
  { id: "P103", name: "Ankit Verma", district: "Muzaffarpur Division", caseRef: "FIR-2024-7719" },
  { id: "P104", name: "Meena Kumari", district: "Nalanda Division", caseRef: "FIR-2024-5290" },
  { id: "P105", name: "Rajesh Prasad", district: "Darbhanga Division", caseRef: "FIR-2024-3310" },
];

export const TEST_OFFICERS_AUTH = [
  { id: "OFF-01", name: "Officer Vikram Singh", role: "Nodal Case Officer", dept: "Patna Division" },
  { id: "OFF-02", name: "Dr. Ananya Sen", role: "Senior Social Worker", dept: "Welfare Cell" },
  { id: "OFF-03", name: "Dr. Rajiv Sharma", role: "Mental Health Specialist", dept: "Clinical Care" },
  { id: "OFF-04", name: "Priya Nair", role: "DM Legal Aid Delegate", dept: "Judicial Support" },
];

export function AuthProvider({ children }) {
  // Default to Case P101 as initial demo session or null if unauthenticated
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('saathi_user');
    return saved ? JSON.parse(saved) : { role: 'victim', ...TEST_VICTIMS[0] };
  });

  const loginAsVictim = (personId) => {
    const found = TEST_VICTIMS.find(v => v.id === personId) || { id: personId, name: `Case ${personId}`, district: 'General' };
    const sessionData = { role: 'victim', ...found };
    setUser(sessionData);
    localStorage.setItem('saathi_user', JSON.stringify(sessionData));
    return sessionData;
  };

  const loginAsOfficer = (officerId) => {
    const found = TEST_OFFICERS_AUTH.find(o => o.id === officerId) || { id: officerId, name: `Officer ${officerId}`, role: 'Nodal Officer', dept: 'District Division' };
    const sessionData = { role: 'officer', ...found };
    setUser(sessionData);
    localStorage.setItem('saathi_user', JSON.stringify(sessionData));
    return sessionData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('saathi_user');
  };

  return (
    <AuthContext.Provider value={{ user, loginAsVictim, loginAsOfficer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
