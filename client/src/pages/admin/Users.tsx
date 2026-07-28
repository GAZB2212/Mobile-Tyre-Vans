import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users as UsersIcon, 
  Shield,
  Eye,
  UserPlus,
  Trash2,
  Wallet,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"none" | "basic" | "full">("none");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check if user is full admin
  useEffect(() => {
    if (user && user.adminRole !== "full") {
      toast({
        title: "Access Denied",
        description: "Full admin access required to manage users.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/admin";
      }, 1000);
      return;
    }
  }, [user, toast]);

  // Fetch users data
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.adminRole === "full",
  });

  // Mutation to create user
  const createUserMutation = useMutation({
    mutationFn: async (userData: { username: string; email: string; firstName?: string; lastName?: string; adminRole: string }) => {
      return await apiRequest("POST", "/api/admin/users", userData);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Created",
        description: `Set-password link sent to ${variables.email}. They'll be prompted to choose their own password.`,
      });
      setIsCreateDialogOpen(false);
      // Reset form
      setNewUsername("");
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewAdminRole("none");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Mutation to update user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, adminRole }: { userId: string; adminRole: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { adminRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
      setDeleteUserId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
      setDeleteUserId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.adminRole !== "full") {
    return null;
  }

  const getRoleBadge = (adminRole: string) => {
    const roleConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string, icon: any }> = {
      "full":    { variant: "default",   label: "Full Admin",       icon: Shield },
      "basic":   { variant: "secondary", label: "Basic Admin",      icon: Eye },
      "finance": { variant: "outline",   label: "Finance Partner",  icon: Wallet },
      "none":    { variant: "outline",   label: "User",             icon: UsersIcon },
    };
    
    const config = roleConfig[adminRole] || roleConfig["none"];
    const IconComponent = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    // Prevent user from changing their own role
    if (userId === user.id) {
      toast({
        title: "Cannot Change Own Role",
        description: "You cannot change your own admin role.",
        variant: "destructive",
      });
      return;
    }

    updateRoleMutation.mutate({ userId, adminRole: newRole });
  };

  const handleCreateUser = () => {
    if (!newUsername) {
      toast({ title: "Missing Fields", description: "Username is required.", variant: "destructive" });
      return;
    }
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: "Missing Fields", description: "A valid email address is required to send the set-password link.", variant: "destructive" });
      return;
    }

    createUserMutation.mutate({
      username: newUsername,
      email: newEmail,
      firstName: newFirstName || undefined,
      lastName: newLastName || undefined,
      adminRole: newAdminRole,
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === user.id) {
      toast({
        title: "Cannot Delete Own Account",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }
    setDeleteUserId(userId);
  };

  return (
    <>
      <AdminBackButton />
      <AdminPageHeader
        title="User Management"
        description="Manage user roles and permissions"
        actions={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-user">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Enter the user's details. They'll receive an email to set their own password.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="johndoe"
                  data-testid="input-username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">A set-password link will be emailed to this address.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="John"
                    data-testid="input-firstname"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Doe"
                    data-testid="input-lastname"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Admin Role</Label>
                <Select value={newAdminRole} onValueChange={(value: any) => setNewAdminRole(value)}>
                  <SelectTrigger data-testid="select-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">User</SelectItem>
                    <SelectItem value="basic">Basic Admin</SelectItem>
                    <SelectItem value="full">Full Admin</SelectItem>
                    <SelectItem value="finance">Finance Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser} 
                disabled={createUserMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />
      <div className="container mx-auto p-6 max-w-7xl">

      {usersLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading users...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((u) => (
            <Card key={u.id} data-testid={`card-user-${u.id}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={u.profileImageUrl || undefined} alt={u.firstName || u.username} />
                      <AvatarFallback className="bg-accent/10 text-accent font-semibold">
                        {u.firstName?.[0] || u.email?.[0] || u.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate" data-testid={`text-username-${u.id}`}>{u.username}</CardTitle>
                      {u.email && <p className="text-sm text-muted-foreground truncate">{u.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getRoleBadge(u.adminRole)}
                    {u.id === user.id && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {u.firstName || u.lastName ? (
                      <p className="text-sm text-muted-foreground">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Role:</span>
                    <Select
                      value={u.adminRole}
                      onValueChange={(newRole) => handleRoleChange(u.id, newRole)}
                      disabled={u.id === user.id || updateRoleMutation.isPending}
                      data-testid={`select-role-${u.id}`}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">User</SelectItem>
                        <SelectItem value="basic">Basic Admin</SelectItem>
                        <SelectItem value="full">Full Admin</SelectItem>
                        <SelectItem value="finance">Finance Partner</SelectItem>
                      </SelectContent>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.id === user.id || deleteUserMutation.isPending}
                          data-testid={`button-delete-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete user</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {users.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
