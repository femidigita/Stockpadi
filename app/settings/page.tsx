"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"

interface BusinessSettings {
  id?: string
  name: string
  logo_url: string
  address: string
  phone: string
  email: string
  receipt_footer: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings>({
    name: "",
    logo_url: "",
    address: "",
    phone: "",
    email: "",
    receipt_footer: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) return

        const { data: business } = await supabase.from("businesses").select("*").eq("owner_id", user.id).single()

        if (business) {
          setSettings({
            id: business.id,
            name: business.name || "",
            logo_url: business.logo_url || "",
            address: business.address || "",
            phone: business.phone || "",
            email: business.email || "",
            receipt_footer: business.receipt_footer || "",
          })
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSubmit = async (formData: FormData) => {
    setIsSaving(true)
    try {
      const user = await getCurrentUser()
      if (!user) return

      const businessData = {
        name: formData.get("name") as string,
        logo_url: formData.get("logo_url") as string,
        address: formData.get("address") as string,
        phone: formData.get("phone") as string,
        email: formData.get("email") as string,
        receipt_footer: formData.get("receipt_footer") as string,
      }

      if (settings.id) {
        // Update existing business
        const { error } = await supabase.from("businesses").update(businessData).eq("id", settings.id)

        if (error) throw error
      } else {
        // Create new business
        const { data, error } = await supabase
          .from("businesses")
          .insert({
            ...businessData,
            owner_id: user.id,
          })
          .select()
          .single()

        if (error) throw error
        setSettings({ ...businessData, id: data.id })
      }

      toast({ title: "Settings saved successfully!" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

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
        <h1 className="text-lg font-semibold md:text-2xl">Business Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Update your business details and branding settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Business Name</Label>
                <Input id="name" name="name" defaultValue={settings.name} placeholder="Your Business Name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={settings.email}
                  placeholder="business@example.com"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" defaultValue={settings.phone} placeholder="+1 (555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  defaultValue={settings.logo_url}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={settings.address}
                placeholder="123 Business St, City, State 12345"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Receipt Footer Note</Label>
              <Textarea
                id="receipt_footer"
                name="receipt_footer"
                defaultValue={settings.receipt_footer}
                placeholder="Thank you for your business! Visit us again soon."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {settings.logo_url && (
        <Card>
          <CardHeader>
            <CardTitle>Logo Preview</CardTitle>
            <CardDescription>This is how your logo will appear on receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
              <img
                src={settings.logo_url || "/placeholder.svg"}
                alt="Business Logo"
                className="max-h-32 max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  )
}
