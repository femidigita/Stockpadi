"use server"

import { getSupabaseAdmin, getSupabaseClient } from "./supabase/server"
import { revalidatePath } from "next/cache"

// Try admin client first, fallback to regular client
async function getWorkingSupabaseClient() {
  try {
    const adminClient = getSupabaseAdmin()
    // lightweight health-check
    await adminClient.rpc("get_admin_analytics")
    return { client: adminClient, isAdmin: true }
  } catch {
    console.warn("Service-role key missing. Running in demo mode.")
    return { client: getSupabaseClient(), isAdmin: false }
  }
}

// User Management Actions
export async function getUsers(page = 1, search = "", limit = 10) {
  try {
    const { client, isAdmin } = await getWorkingSupabaseClient()

    if (!isAdmin) {
      // If we don't have admin access, return mock data for demo
      return {
        users: [
          {
            id: "demo-user-1",
            email: "demo@example.com",
            created_at: new Date().toISOString(),
            full_name: "Demo User",
            company_name: "Demo Company",
            is_active: true,
            sales_count: 5,
          },
        ],
        total: 1,
      }
    }

    // Get users from auth.users (admin only)
    const { data: authData, error: authError } = await client.auth.admin.listUsers({
      page,
      perPage: limit,
    })

    if (authError) {
      console.error("Auth error:", authError)
      if (authError.message?.includes("User not allowed")) {
        throw new Error("Admin endpoint blocked: add SUPABASE_SERVICE_ROLE_KEY to your Vercel project for full access.")
      }
      return { users: [], total: 0 }
    }

    if (!authData.users || authData.users.length === 0) {
      return { users: [], total: 0 }
    }

    const userIds = authData.users.map((u) => u.id)

    // Get profile data
    const { data: profiles } = await client.from("user_profiles").select("*").in("id", userIds)

    // Get sales count for each user
    const { data: salesData } = await client.from("sales_entries").select("user_id").in("user_id", userIds)

    // Combine data
    const combinedUsers = authData.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id)
      const salesCount = salesData?.filter((s) => s.user_id === authUser.id).length || 0

      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        full_name: profile?.full_name || "N/A",
        company_name: profile?.company_name || "N/A",
        is_active: profile?.is_active ?? true,
        sales_count: salesCount,
      }
    })

    return {
      users: combinedUsers,
      total: authData.total || 0,
    }
  } catch (error) {
    console.error("Error fetching users:", error)
    return { users: [], total: 0 }
  }
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  try {
    const { client } = await getWorkingSupabaseClient()
    const { error } = await client.from("user_profiles").upsert({
      id: userId,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })

    if (error) throw error
    revalidatePath("/adminpanel")
  } catch (error) {
    console.error("Error updating user status:", error)
    throw error
  }
}

export async function deleteUser(userId: string) {
  try {
    const { client, isAdmin } = await getWorkingSupabaseClient()

    if (!isAdmin) {
      throw new Error("Admin privileges required to delete users")
    }

    const { error } = await client.auth.admin.deleteUser(userId)
    if (error) throw error
    revalidatePath("/adminpanel")
  } catch (error) {
    console.error("Error deleting user:", error)
    throw error
  }
}

// Subscription Plan Management
export async function getSubscriptionPlans() {
  try {
    const { client } = await getWorkingSupabaseClient()
    const { data, error } = await client.from("subscription_plans").select("*").order("price")

    if (error) {
      console.error("Error fetching plans:", error)
      return []
    }
    return data || []
  } catch (error) {
    console.error("Error fetching subscription plans:", error)
    return []
  }
}

export async function createSubscriptionPlan(plan: {
  name: string
  price: number
  duration_months: number
  features: string[]
  max_sales_entries: number
}) {
  try {
    const { client } = await getWorkingSupabaseClient()
    const { error } = await client.from("subscription_plans").insert(plan)
    if (error) throw error
    revalidatePath("/adminpanel")
  } catch (error) {
    console.error("Error creating subscription plan:", error)
    throw error
  }
}

// Analytics
export async function getAdminAnalytics() {
  try {
    const { client } = await getWorkingSupabaseClient()

    // Try the RPC function first
    const { data, error } = await client.rpc("get_admin_analytics")

    if (error && !error.message.includes("Invalid API key")) {
      console.warn("Analytics function error:", error)
    }

    if (error || !data) {
      // Fallback: calculate analytics manually
      const [usersResult, profilesResult, subscriptionsResult, salesResult] = await Promise.all([
        client
          .from("auth.users")
          .select("count")
          .single()
          .catch(() => ({ count: 0 })),
        client
          .from("user_profiles")
          .select("count")
          .eq("is_active", true)
          .single()
          .catch(() => ({ count: 0 })),
        client
          .from("subscriptions")
          .select("count")
          .eq("status", "active")
          .single()
          .catch(() => ({ count: 0 })),
        client
          .from("sales_entries")
          .select("amount")
          .catch(() => []),
      ])

      const totalSalesVolume = Array.isArray(salesResult)
        ? salesResult.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
        : 0

      return {
        total_users: Number(usersResult?.count) || 0,
        active_users: Number(profilesResult?.count) || 0,
        total_subscriptions: Number(subscriptionsResult?.count) || 0,
        monthly_revenue: 0, // Would need payments table
        total_sales_entries: Array.isArray(salesResult) ? salesResult.length : 0,
        total_sales_volume: totalSalesVolume,
        top_plan: "N/A",
      }
    }

    // Handle the jsonb response from RPC
    const result = data || {}
    return {
      total_users: Number(result.total_users) || 0,
      active_users: Number(result.active_users) || 0,
      total_subscriptions: Number(result.total_subscriptions) || 0,
      monthly_revenue: Number(result.monthly_revenue) || 0,
      total_sales_entries: Number(result.total_sales_entries) || 0,
      total_sales_volume: Number(result.total_sales_volume) || 0,
      top_plan: result.top_plan || "N/A",
    }
  } catch (error) {
    console.error("Error fetching admin analytics:", error)
    return {
      total_users: 0,
      active_users: 0,
      total_subscriptions: 0,
      monthly_revenue: 0,
      total_sales_entries: 0,
      total_sales_volume: 0,
      top_plan: "N/A",
    }
  }
}

export async function getSalesAnalytics() {
  try {
    const { client } = await getWorkingSupabaseClient()
    const { data, error } = await client
      .from("sales_entries")
      .select("amount, sale_date, user_id")
      .gte("sale_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])

    if (error) {
      console.warn("Sales analytics error:", error)
      return []
    }
    return data || []
  } catch (error) {
    console.error("Error fetching sales analytics:", error)
    return []
  }
}
