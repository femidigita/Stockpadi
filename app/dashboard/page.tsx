"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { DollarSign, TrendingUp, TrendingDown, Receipt } from "lucide-react"

interface DashboardStats {
  totalSales: number
  totalExpenses: number
  netProfit: number
  transactionCount: number
  monthlyData: Array<{
    month: string
    sales: number
    expenses: number
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    transactionCount: 0,
    monthlyData: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) return

        // Get user's business
        const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single()

        if (!business) return

        // Get transactions for the current year
        const currentYear = new Date().getFullYear()
        const { data: transactions } = await supabase
          .from("transactions")
          .select("*")
          .eq("business_id", business.id)
          .gte("transaction_date", `${currentYear}-01-01`)
          .lte("transaction_date", `${currentYear}-12-31`)

        if (transactions) {
          const sales = transactions.filter((t) => t.type === "sale")
          const expenses = transactions.filter((t) => t.type === "expense")

          const totalSales = sales.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)
          const totalExpenses = expenses.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)

          // Generate monthly data
          const monthlyData = []
          for (let i = 0; i < 12; i++) {
            const month = new Date(currentYear, i, 1)
            const monthName = month.toLocaleDateString("en-US", { month: "short" })

            const monthSales = sales
              .filter((t) => new Date(t.transaction_date).getMonth() === i)
              .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)

            const monthExpenses = expenses
              .filter((t) => new Date(t.transaction_date).getMonth() === i)
              .reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)

            monthlyData.push({
              month: monthName,
              sales: monthSales,
              expenses: monthExpenses,
            })
          }

          setStats({
            totalSales,
            totalExpenses,
            netProfit: totalSales - totalExpenses,
            transactionCount: transactions.length,
            monthlyData,
          })
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

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
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${stats.netProfit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transactionCount}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales vs Expenses</CardTitle>
            <CardDescription>Compare your sales and expenses by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#8884d8" name="Sales" />
                <Bar dataKey="expenses" fill="#82ca9d" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
            <CardDescription>Monthly profit over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={(data) => data.sales - data.expenses} stroke="#8884d8" name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
