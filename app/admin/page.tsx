"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Users, Building2, DollarSign, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"

interface AdminStats {
  totalUsers: number
  totalBusinesses: number
  totalRevenue: number
  activeSubscriptions: number
  monthlySignups: Array<{
    month: string
    users: number
    businesses: number
  }>
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    monthlySignups: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const user = await getCurrentUser()
        if (!user || user.role !== "super_admin") {
          router.push("/dashboard")
          return
        }

        // Get total users
        const { count: userCount } = await supabase.from("users").select("*", { count: "exact", head: true })

        // Get total businesses
        const { count: businessCount } = await supabase.from("businesses").select("*", { count: "exact", head: true })

        // Get active subscriptions
        const { count: subscriptionCount } = await supabase
          .from("business_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")

        // Calculate total revenue (mock calculation)
        const { data: subscriptions } = await supabase
          .from("business_subscriptions")
          .select(`
            subscription_plans(price)
          `)
          .eq("status", "active")

        const totalRevenue =
          subscriptions?.reduce((sum, sub) => {
            return sum + (sub.subscription_plans?.price || 0)
          }, 0) || 0

        // Generate monthly signup data
        const monthlyData = []
        for (let i = 5; i >= 0; i--) {
          const date = new Date()
          date.setMonth(date.getMonth() - i)
          const monthName = date.toLocaleDateString("en-US", { month: "short" })

          // Mock data for demonstration
          monthlyData.push({
            month: monthName,
            users: Math.floor(Math.random() * 20) + 5,
            businesses: Math.floor(Math.random() * 15) + 3,
          })
        }

        setStats({
          totalUsers: userCount || 0,
          totalBusinesses: businessCount || 0,
          totalRevenue,
          activeSubscriptions: subscriptionCount || 0,
          monthlySignups: monthlyData,
        })
      } catch (error) {
        console.error("Error loading admin data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAdminData()
  }, [router])

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Admin Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBusinesses}</div>
            <p className="text-xs text-muted-foreground">Active businesses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Signups</CardTitle>
          <CardDescription>New users and businesses over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.monthlySignups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="users" fill="#8884d8" name="Users" />
              <Bar dataKey="businesses" fill="#82ca9d" name="Businesses" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
