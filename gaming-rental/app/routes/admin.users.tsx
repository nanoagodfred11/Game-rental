import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import {
  Card,
  CardBody,
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  Users,
  KeyRound,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Phone,
  Home,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { User } from "~/models/user.server";
import { Booking } from "~/models/booking.server";
import { AuditLog } from "~/models/audit-log.server";
import { hashPassword } from "~/services/auth.server";
import { passwordResetSchema } from "~/lib/validation";
import { formatCurrency } from "~/lib/constants";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const users = await User.find().sort({ created_at: -1 }).lean();

  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      const bookingCount = await Booking.countDocuments({
        user_id: user._id.toString(),
      });

      return {
        id: user._id.toString(),
        email: user.email,
        full_name: user.full_name,
        phone_number: user.phone_number,
        hostel_name: user.hostel_name,
        room_number: user.room_number,
        role: user.role,
        is_active: user.is_active,
        is_verified: user.is_verified,
        total_bookings: bookingCount,
        total_amount_spent: user.total_amount_spent,
        loyalty_points: user.loyalty_points,
        created_at: user.created_at.toISOString(),
        last_booking_at: user.last_booking_at
          ? user.last_booking_at.toISOString()
          : null,
      };
    })
  );

  return { users: usersWithStats };
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "reset-password") {
    const raw = {
      user_email: formData.get("user_email") as string,
      new_password: formData.get("new_password") as string,
    };

    const result = passwordResetSchema.safeParse(raw);
    if (!result.success) {
      return { error: result.error.issues[0].message, intent };
    }

    const user = await User.findOne({ email: result.data.user_email });
    if (!user) {
      return { error: "User not found", intent };
    }

    const hashedPassword = await hashPassword(result.data.new_password);
    user.hashed_password = hashedPassword;
    await user.save();

    await AuditLog.logAction({
      action: "password_reset",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "user",
      target_id: user._id.toString(),
      details: { target_email: user.email },
    });

    return { success: `Password reset for ${user.email}`, intent };
  }

  if (intent === "toggle-active") {
    const userId = formData.get("userId") as string;

    const user = await User.findById(userId);
    if (!user) {
      return { error: "User not found", intent };
    }

    // Prevent deactivating yourself
    if (user._id.toString() === admin._id.toString()) {
      return { error: "Cannot deactivate your own account", intent };
    }

    const previousState = { is_active: user.is_active };
    user.is_active = !user.is_active;
    await user.save();

    await AuditLog.logAction({
      action: user.is_active ? "user_activated" : "user_deactivated",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "user",
      target_id: user._id.toString(),
      previous_state: previousState,
      new_state: { is_active: user.is_active },
      details: { target_email: user.email },
    });

    return {
      success: `User ${user.email} ${user.is_active ? "activated" : "deactivated"}`,
      intent,
    };
  }

  return { error: "Invalid action", intent };
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const resetModal = useDisclosure();
  const [resetEmail, setResetEmail] = useState("");

  function handleResetPassword(email: string) {
    setResetEmail(email);
    resetModal.onOpen();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-500 mt-1">
            Manage users and their accounts ({users.length} total)
          </p>
        </div>
      </div>

      {actionData?.error && (
        <Card className="mb-4 border-danger-500/30 bg-danger-500/10">
          <CardBody className="py-3 text-danger-400 text-sm">
            {actionData.error}
          </CardBody>
        </Card>
      )}
      {actionData?.success && (
        <Card className="mb-4 border-success-500/30 bg-success-500/10">
          <CardBody className="py-3 text-success-400 text-sm">
            {actionData.success}
          </CardBody>
        </Card>
      )}

      <Card className="bg-surface-800 border border-white/10">
        <CardBody className="p-0">
          <Table aria-label="Users table" removeWrapper>
            <TableHeader>
              <TableColumn>USER</TableColumn>
              <TableColumn>CONTACT</TableColumn>
              <TableColumn>HOSTEL</TableColumn>
              <TableColumn>ROLE</TableColumn>
              <TableColumn>BOOKINGS</TableColumn>
              <TableColumn>SPENT</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No users found">
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary-500" />
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Phone className="h-3 w-3" />
                      {user.phone_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        <Home className="h-3 w-3 text-gray-400" />
                        {user.hostel_name}
                      </div>
                      <span className="text-xs text-gray-400">
                        Room {user.room_number}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={user.role === "admin" ? "secondary" : "default"}
                      startContent={
                        user.role === "admin" ? (
                          <Shield className="h-3 w-3" />
                        ) : undefined
                      }
                    >
                      {user.role}
                    </Chip>
                  </TableCell>
                  <TableCell>{user.total_bookings}</TableCell>
                  <TableCell>{formatCurrency(user.total_amount_spent)}</TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      color={user.is_active ? "success" : "danger"}
                      variant="flat"
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<KeyRound className="h-3 w-3" />}
                        onPress={() => handleResetPassword(user.email)}
                      >
                        Reset Password
                      </Button>
                      {user.role !== "admin" && (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="toggle-active"
                          />
                          <input
                            type="hidden"
                            name="userId"
                            value={user.id}
                          />
                          <Button
                            size="sm"
                            color={user.is_active ? "danger" : "success"}
                            variant="flat"
                            type="submit"
                            isLoading={isSubmitting}
                            startContent={
                              user.is_active ? (
                                <UserX className="h-3 w-3" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )
                            }
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </Form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Password Reset Modal */}
      <Modal
        isOpen={resetModal.isOpen}
        onOpenChange={resetModal.onOpenChange}
        size="md"
      >
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <input type="hidden" name="intent" value="reset-password" />
              <input type="hidden" name="user_email" value={resetEmail} />
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Reset Password</h2>
                <p className="text-sm text-gray-500">{resetEmail}</p>
              </ModalHeader>
              <ModalBody>
                <Input
                  name="new_password"
                  label="New Password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  isRequired
                  minLength={8}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" isLoading={isSubmitting}>
                  Reset Password
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
