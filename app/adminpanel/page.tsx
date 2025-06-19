import { Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "@/components/admin/user-management"
import { SubscriptionManagement } from "@/components/admin/subscription-management"
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function LoadingCard() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPanel() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h2>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscription Plans</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <Suspense fallback={<LoadingCard />}>
            <AnalyticsDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Suspense fallback={<LoadingCard />}>
            <UserManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Suspense fallback={<LoadingCard />}>
            <SubscriptionManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications & Messaging</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Notification management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
