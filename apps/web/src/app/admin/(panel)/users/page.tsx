"use client";

import { useEffect, useState } from "react";
import { ROLES, type AuthUser, type Role } from "@sellme/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { RequireRole } from "@/components/admin/RequireRole";

export default function UsersPage() {
  return (
    <RequireRole role="ADMIN">
      <Users />
    </RequireRole>
  );
}

function Users() {
  const me = useSession((s) => s.user);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("OPS_STAFF");

  async function refresh() {
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    setError(null);
    try {
      await api.createUser({ name, email, password, role });
      setName(""); setEmail(""); setPassword("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API \d+ on \S+ /, "") : "Create failed.");
    }
  }
  async function setUserRole(u: AuthUser, r: Role) { await api.updateUser(u.id, { role: r }); refresh(); }
  async function toggleActive(u: AuthUser) { await api.updateUser(u.id, { active: !u.active }); refresh(); }
  async function remove(u: AuthUser) {
    if (!confirm(`Remove ${u.email}?`)) return;
    try { await api.deleteUser(u.id); refresh(); } catch (e) { setError(e instanceof Error ? e.message.replace(/^API \d+ on \S+ /, "") : "Delete failed."); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Staff &amp; roles</h1>
        <p className="text-ink-500">Manage back-office accounts. Admins manage everything; staff handle orders, grading and resale.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-400">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="p-3 font-medium">{u.name}{me?.id === u.id && <span className="ml-2 text-xs text-ink-300">(you)</span>}</td>
                <td className="p-3 text-ink-600">{u.email}</td>
                <td className="p-3">
                  <select className="input w-32 py-1.5" value={u.role} onChange={(e) => setUserRole(u, e.target.value as Role)} disabled={me?.id === u.id}>
                    {ROLES.map((r) => <option key={r} value={r}>{r === "ADMIN" ? "Admin" : "Ops staff"}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button onClick={() => toggleActive(u)} disabled={me?.id === u.id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-ink-400"}`}>
                    {u.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  {me?.id !== u.id && <button onClick={() => remove(u)} className="text-xs font-semibold text-ink-400 hover:text-red-600">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Add staff member</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{r === "ADMIN" ? "Admin" : "Ops staff"}</option>)}
          </select>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-3" disabled={!name || !email || password.length < 6} onClick={create}>Create account</button>
      </div>
    </div>
  );
}
