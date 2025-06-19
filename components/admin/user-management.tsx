"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, UserCheck, UserX, Trash2, Users, AlertTriangle } from "lucide-react"
import { getUsers, updateUserStatus, deleteUser } from "@/lib/admin-actions"

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [isDemoMode, setIsDemoMode] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [search, page])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await getUsers(page, search)
      setUsers(result.users)
      // Check if we're in demo mode (when admin access isn't available)
      setIsDemoMode(result.users.some((user) => user.id.startsWith("demo-")))
    } catch (error) {
      console.error("Failed to load users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    if (isDemoMode) {
      alert("Demo mode: User management requires admin privileges")
      return
    }

    try {
      await updateUserStatus(userId, !currentStatus)
      loadUsers()
    } catch (error) {
      console.error("Failed to update user status:", error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (isDemoMode) {
      alert("Demo mode: User deletion requires admin privileges")
      return
    }

    if (confirm("Are you sure you want to permanently delete this user?")) {
      try {
        await deleteUser(userId)
        loadUsers()
      } catch (error) {
        console.error("Failed to delete user:", error)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        {isDemoMode && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Demo mode: Limited functionality. Add SUPABASE_SERVICE_ROLE_KEY environment variable for full admin
              access.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No users found</h3>
            <p className="text-muted-foreground">
              {search ? "No users match your search criteria." : "No users have signed up yet."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sales Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{user.company_name}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.sales_count}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusToggle(user.id, user.is_active)}
                        disabled={isDemoMode}
                      >
                        {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={isDemoMode}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
