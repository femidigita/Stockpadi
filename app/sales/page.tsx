"use client"

import { useState, useEffect } from "react"
import { Plus, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"

interface Sale {
  id: string
  amount: number
  description: string
  customer_name: string
  customer_email: string
  receipt_number: string
  transaction_date: string
  product: {
    name: string
    price: number
  } | null
}

interface Product {
  id: string
  name: string
  price: number
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) return

        // Get user's business
        const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single()

        if (business) {
          setBusinessId(business.id)

          // Load sales
          const { data: salesData } = await supabase
            .from("transactions")
            .select(`
              *,
              product:products(name, price)
            `)
            .eq("business_id", business.id)
            .eq("type", "sale")
            .order("transaction_date", { ascending: false })

          if (salesData) {
            setSales(salesData)
          }

          // Load products
          const { data: productsData } = await supabase
            .from("products")
            .select("id, name, price")
            .eq("business_id", business.id)
            .eq("is_active", true)

          if (productsData) {
            setProducts(productsData)
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const generateReceiptNumber = () => {
    return `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  }

  const handleSubmit = async (formData: FormData) => {
    if (!businessId) return

    try {
      const productId = formData.get("product_id") as string
      const customAmount = formData.get("custom_amount") as string
      const selectedProduct = products.find((p) => p.id === productId)

      const amount = customAmount ? Number.parseFloat(customAmount) : selectedProduct?.price || 0

      const saleData = {
        business_id: businessId,
        type: "sale" as const,
        amount,
        description: formData.get("description") as string,
        customer_name: formData.get("customer_name") as string,
        customer_email: formData.get("customer_email") as string,
        product_id: productId || null,
        receipt_number: generateReceiptNumber(),
        transaction_date: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("transactions")
        .insert(saleData)
        .select(`
          *,
          product:products(name, price)
        `)
        .single()

      if (error) throw error

      setSales([data, ...sales])
      toast({ title: "Sale recorded successfully!" })
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Sales</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form action={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Record New Sale</DialogTitle>
                <DialogDescription>Add a new sale transaction to your records.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="product_id">Product/Service</Label>
                  <Select name="product_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - ${product.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom_amount">Custom Amount (optional)</Label>
                  <Input
                    id="custom_amount"
                    name="custom_amount"
                    type="number"
                    step="0.01"
                    placeholder="Override product price"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer_name">Customer Name</Label>
                  <Input id="customer_name" name="customer_name" placeholder="Customer name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer_email">Customer Email</Label>
                  <Input id="customer_email" name="customer_email" type="email" placeholder="customer@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" placeholder="Sale description" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Record Sale</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
          <CardDescription>View and manage your sales transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No sales recorded yet. Record your first sale to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product/Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.receipt_number}</TableCell>
                    <TableCell>{sale.customer_name}</TableCell>
                    <TableCell>{sale.product?.name || sale.description}</TableCell>
                    <TableCell>${sale.amount.toFixed(2)}</TableCell>
                    <TableCell>{new Date(sale.transaction_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="icon">
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
