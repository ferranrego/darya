import { supabaseService } from "@/lib/supabase/server";
import { Users, Settings, Database, Download, Activity, Award } from "lucide-react";
import Link from "next/link";
import { profile as lang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = supabaseService();

  // Fetch profiles
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch auth users to map emails
  const { data: authData, error: authError } = await admin.auth.admin.listUsers();
  
  if (profilesError || authError) {
    return (
      <div className="p-8 text-danger">
        Error loading admin data: {profilesError?.message} {authError?.message}
      </div>
    );
  }

  const usersMap = new Map(authData.users.map(u => [u.id, u.email]));

  const totalUsers = profiles?.length || 0;
  const totalXp = profiles?.reduce((sum, p) => sum + (p.xp || 0), 0) || 0;
  const onboardedUsers = profiles?.filter(p => p.onboarded_at).length || 0;

  return (
    <div className="min-h-dvh bg-paper text-ink pb-24">
      {/* Header */}
      <header className="bg-surface border-b border-line px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-lapis/10 p-2 rounded-lg">
            <Database className="w-5 h-5 text-lapis" />
          </div>
          <h1 className="text-xl font-semibold">{lang.brand.appName} Admin</h1>
        </div>
        <div className="flex gap-4">
          <Link
            href="/"
            className="text-sm text-ink-soft hover:text-ink transition-colors font-medium self-center"
          >
            Exit Admin
          </Link>
          <a
            href="/admin/export"
            className="flex items-center gap-2 bg-sabz text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sabz/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-6 space-y-8">
        
        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex items-center gap-4">
            <div className="bg-lapis-soft p-3 rounded-full text-lapis">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-ink-soft font-medium">Total Users</p>
              <p className="text-2xl font-semibold">{totalUsers}</p>
            </div>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex items-center gap-4">
            <div className="bg-saffron-soft p-3 rounded-full text-saffron">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-ink-soft font-medium">Onboarded</p>
              <p className="text-2xl font-semibold">{onboardedUsers}</p>
            </div>
          </div>
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex items-center gap-4">
            <div className="bg-sabz-soft p-3 rounded-full text-sabz">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-ink-soft font-medium">Total XP Earned</p>
              <p className="text-2xl font-semibold">{totalXp.toLocaleString()}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Mock Panel */}
          <section className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <Settings className="w-5 h-5 text-ink-soft" />
              <h2 className="text-lg font-medium">App Settings</h2>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Maintenance Mode</p>
                  <p className="text-xs text-ink-soft">Disable access for non-admins</p>
                </div>
                <div className="w-10 h-6 bg-line rounded-full relative cursor-not-allowed opacity-50">
                  <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Allow Registrations</p>
                  <p className="text-xs text-ink-soft">New users can sign up</p>
                </div>
                <div className="w-10 h-6 bg-sabz rounded-full relative cursor-not-allowed opacity-80">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Debug Logging</p>
                  <p className="text-xs text-ink-soft">Verbose client logs</p>
                </div>
                <div className="w-10 h-6 bg-line rounded-full relative cursor-not-allowed opacity-50">
                  <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-xs text-ink-faint text-center">Settings are mock UI only</p>
              </div>
            </div>
          </section>

          {/* Users Table */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <Users className="w-5 h-5 text-ink-soft" />
              <h2 className="text-lg font-medium">Registered Users</h2>
            </div>
            <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-new-tint/50 text-ink-soft">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Level</th>
                      <th className="px-4 py-3 font-medium text-right">XP</th>
                      <th className="px-4 py-3 font-medium text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {profiles?.map(profile => (
                      <tr key={profile.id} className="hover:bg-new-tint/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink">
                          {profile.display_name || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-ink-soft truncate max-w-[150px]" title={usersMap.get(profile.id)}>
                          {usersMap.get(profile.id) || "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-lapis-soft text-lapis text-xs px-2 py-1 rounded-md font-medium">
                            {profile.level_estimate || "L1"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {profile.xp}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-soft">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {profiles?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
