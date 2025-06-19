"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Edit, DollarSign } from "lucide-react"
import { getSubscriptionPlans, createSubscriptionPlan } from "@/lib/admin-actions"

export function SubscriptionManagement() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    setLoading(true)
    try {
      const data = await getSubscriptionPlans()
      setPlans(data)
    } catch (error) {
      console.error("Failed to load plans:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = async (formData: FormData) => {
    try {
      await createSubscriptionPlan({
        name: formData.get("name") as string,
        price: Number.parseFloat(formData.get("price") as string),
        duration_months: Number.parseInt(formData.get("duration") as string),
        features: (formData.get("features") as string).split(",").map((f) => f.trim()),
        max_sales_entries: Number.parseInt(formData.get("max_entries") as string),
      })
      setShowCreateDialog(false)
      loadPlans()
    } catch (error) {
      console.error("Failed to create plan:", error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription Plans</CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Plan</DialogTitle>
                <DialogDescription>Create a new subscription plan with pricing and features.</DialogDescription>
              </DialogHeader>
              <form action={handleCreatePlan} className="space-y-4">
                <div>
                  <Label htmlFor="name">Plan Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="price">Price ($)</Label>
                  <Input id="price" name="price" type="number" step="0.01" required />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (months)</Label>
                  <Input id="duration" name="duration" type="number" defaultValue="1" required />
                </div>
                <div>
                  <Label htmlFor="features">Features (comma-separated)</Label>
                  <Input id="features" name="features" required />
                </div>
                <div>
                  <Label htmlFor="max_entries">Max Sales Entries (-1 for unlimited)</Label>
                  <Input id="max_entries" name="max_entries" type="number" required />
                </div>
                <Button type="submit" className="w-full">
                  Create Plan
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading plans...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Max Entries</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {plan.price}
                    </div>
                  </TableCell>
                  <TableCell>{plan.duration_months} month(s)</TableCell>
                  <TableCell>{plan.max_sales_entries === -1 ? "Unlimited" : plan.max_sales_entries}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${plan.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
