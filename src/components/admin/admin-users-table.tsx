'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  APP_ADMIN_ROLE,
  ASSIGNABLE_ROLES,
  COMPANY_ADMIN_ROLE,
  COMPANY_MEMBER_ROLE,
} from '@/lib/auth';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
};

type CompanyOption = { id: string; name: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type AdminUsersTableProps = {
  companyFilter?: string;
  showCompanyColumn?: boolean;
};

export function AdminUsersTable({
  companyFilter,
  showCompanyColumn = true,
}: AdminUsersTableProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState(companyFilter ?? 'all');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyParam =
        filterCompanyId && filterCompanyId !== 'all' ? `?companyId=${filterCompanyId}` : '';
      const [usersRes, companiesRes] = await Promise.all([
        fetch(`/api/admin/users${companyParam}`),
        fetch('/api/admin/companies'),
      ]);
      const usersData = await usersRes.json();
      const companiesData = await companiesRes.json();
      if (!usersRes.ok) throw new Error(usersData.error || 'Failed to load users');
      if (!companiesRes.ok) throw new Error(companiesData.error || 'Failed to load companies');
      setUsers(usersData);
      setCompanies(companiesData.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filterCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name?.toLowerCase().includes(q) ?? false) ||
      (u.companyName?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleRoleChange = async (userId: string, role: string) => {
    setActionId(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data } : u)));
      setSuccess('User role updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user permanently?')) return;
    setActionId(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccess('User deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>
        {!companyFilter && (
          <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filter by company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {showCompanyColumn && <TableHead>Company</TableHead>}
              <TableHead>Joined</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showCompanyColumn ? 6 : 5}
                  className="py-10 text-center text-slate-500"
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || user.email.split('@')[0]}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={
                        ASSIGNABLE_ROLES.includes(user.role as (typeof ASSIGNABLE_ROLES)[number])
                          ? user.role
                          : COMPANY_MEMBER_ROLE
                      }
                      onValueChange={(v) => handleRoleChange(user.id, v)}
                      disabled={actionId === user.id}
                    >
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={APP_ADMIN_ROLE}>Platform Admin</SelectItem>
                        <SelectItem value={COMPANY_ADMIN_ROLE}>Company Admin</SelectItem>
                        <SelectItem value={COMPANY_MEMBER_ROLE}>Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {showCompanyColumn && (
                    <TableCell>
                      {user.companyId && user.companyName ? (
                        <Link
                          href={`/admin/companies/${user.companyId}`}
                          className="text-sm text-violet-600 hover:underline"
                        >
                          {user.companyName}
                        </Link>
                      ) : user.role === APP_ADMIN_ROLE ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-slate-500">{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={actionId === user.id}
                      onClick={() => handleDelete(user.id)}
                      title="Delete user"
                    >
                      {actionId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
