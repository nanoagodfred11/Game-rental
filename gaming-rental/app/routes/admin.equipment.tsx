import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
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
  Textarea,
} from "@heroui/react";
import {
  Plus,
  Pencil,
  RotateCcw,
  Monitor,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { Equipment, EquipmentStatus } from "~/models/equipment.server";
import { AuditLog } from "~/models/audit-log.server";
import { equipmentCreateSchema, equipmentUpdateSchema } from "~/lib/validation";
import { formatCurrency } from "~/lib/constants";
import StatusBadge from "~/components/ui/status-badge";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const equipment = await Equipment.find().sort({ created_at: -1 }).lean();

  return {
    equipment: equipment.map((eq) => ({
      id: eq._id.toString(),
      name: eq.name,
      equipment_id: eq.equipment_id,
      description: eq.description || "",
      components: eq.components || [],
      status: eq.status,
      current_booking_id: eq.current_booking_id,
      hourly_rate: eq.hourly_rate,
      total_bookings: eq.total_bookings,
      total_hours_rented: eq.total_hours_rented,
      total_revenue: eq.total_revenue,
      created_at: eq.created_at.toISOString(),
    })),
  };
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const raw = {
      name: formData.get("name") as string,
      equipment_id: formData.get("equipment_id") as string,
      description: formData.get("description") as string,
      components: formData.get("components") as string,
      hourly_rate: formData.get("hourly_rate") as string,
    };

    const result = equipmentCreateSchema.safeParse(raw);
    if (!result.success) {
      return { error: result.error.issues[0].message, intent };
    }

    const existing = await Equipment.findOne({ equipment_id: result.data.equipment_id });
    if (existing) {
      return { error: "Equipment ID already exists", intent };
    }

    const componentsArr = result.data.components
      ? result.data.components.split(",").map((c) => c.trim()).filter(Boolean)
      : [
          "PlayStation 5 Console",
          "DualSense Controller x2",
          "32-inch TV",
          "HDMI Cable",
          "Power Strip",
        ];

    await Equipment.create({
      name: result.data.name,
      equipment_id: result.data.equipment_id,
      description: result.data.description || "PlayStation 5 with TV and 2 controllers",
      components: componentsArr,
      hourly_rate: result.data.hourly_rate,
      status: EquipmentStatus.AVAILABLE,
    });

    return { success: "Equipment created successfully", intent };
  }

  if (intent === "update") {
    const equipmentId = formData.get("equipmentId") as string;
    const raw = {
      name: formData.get("name") as string || undefined,
      description: formData.get("description") as string || undefined,
      status: formData.get("status") as string || undefined,
      hourly_rate: formData.get("hourly_rate") as string || undefined,
    };

    // Remove undefined fields
    const cleaned = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== undefined && v !== "")
    );

    const result = equipmentUpdateSchema.safeParse(cleaned);
    if (!result.success) {
      return { error: result.error.issues[0].message, intent };
    }

    const equipment = await Equipment.findOne({ equipment_id: equipmentId });
    if (!equipment) {
      return { error: "Equipment not found", intent };
    }

    const previousState = {
      name: equipment.name,
      description: equipment.description,
      status: equipment.status,
      hourly_rate: equipment.hourly_rate,
    };

    Object.assign(equipment, result.data);
    await equipment.save();

    await AuditLog.logAction({
      action: "equipment_updated",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "equipment",
      target_id: equipmentId,
      previous_state: previousState,
      new_state: result.data,
    });

    return { success: "Equipment updated successfully", intent };
  }

  if (intent === "reset") {
    const equipmentId = formData.get("equipmentId") as string;

    const equipment = await Equipment.findOne({ equipment_id: equipmentId });
    if (!equipment) {
      return { error: "Equipment not found", intent };
    }

    const previousState = {
      status: equipment.status,
      current_booking_id: equipment.current_booking_id,
    };

    equipment.status = EquipmentStatus.AVAILABLE;
    equipment.current_booking_id = null;
    await equipment.save();

    await AuditLog.logAction({
      action: "equipment_force_reset",
      actor_id: admin._id.toString(),
      actor_email: admin.email,
      actor_role: admin.role,
      target_type: "equipment",
      target_id: equipmentId,
      previous_state: previousState,
      new_state: { status: EquipmentStatus.AVAILABLE, current_booking_id: null },
      details: { reason: "Force reset stuck equipment" },
    });

    return { success: "Equipment reset to available", intent };
  }

  return { error: "Invalid action", intent };
}

export default function AdminEquipment() {
  const { equipment } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const [editingEquipment, setEditingEquipment] = useState<(typeof equipment)[0] | null>(null);

  function handleEdit(eq: (typeof equipment)[0]) {
    setEditingEquipment(eq);
    editModal.onOpen();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Equipment Management</h1>
          <p className="text-gray-500 mt-1">Manage PS5 equipment sets</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="h-4 w-4" />}
          onPress={createModal.onOpen}
        >
          Add Equipment
        </Button>
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
          <Table aria-label="Equipment table" removeWrapper>
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>ID</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>RATE</TableColumn>
              <TableColumn>BOOKINGS</TableColumn>
              <TableColumn>REVENUE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No equipment found">
              {equipment.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary-500" />
                      <span className="font-medium">{eq.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-gray-500">
                      {eq.equipment_id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={eq.status} />
                  </TableCell>
                  <TableCell>{formatCurrency(eq.hourly_rate)}/hr</TableCell>
                  <TableCell>{eq.total_bookings}</TableCell>
                  <TableCell>{formatCurrency(eq.total_revenue)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Pencil className="h-3 w-3" />}
                        onPress={() => handleEdit(eq)}
                      >
                        Edit
                      </Button>
                      {eq.status !== "available" && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="reset" />
                          <input type="hidden" name="equipmentId" value={eq.equipment_id} />
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            type="submit"
                            isLoading={isSubmitting}
                            startContent={<RotateCcw className="h-3 w-3" />}
                          >
                            Reset
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

      {/* Create Equipment Modal */}
      <Modal isOpen={createModal.isOpen} onOpenChange={createModal.onOpenChange} size="lg">
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <input type="hidden" name="intent" value="create" />
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Add New Equipment</h2>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    name="name"
                    label="Equipment Name"
                    placeholder="e.g. PS5 Set A"
                    isRequired
                  />
                  <Input
                    name="equipment_id"
                    label="Equipment ID"
                    placeholder="e.g. PS5-003"
                    isRequired
                  />
                  <Textarea
                    name="description"
                    label="Description"
                    placeholder="PlayStation 5 with TV and 2 controllers"
                  />
                  <Input
                    name="components"
                    label="Components (comma-separated)"
                    placeholder="PlayStation 5 Console, DualSense Controller x2, 32-inch TV"
                  />
                  <Input
                    name="hourly_rate"
                    label="Hourly Rate (GHS)"
                    type="number"
                    defaultValue="70"
                    isRequired
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" isLoading={isSubmitting}>
                  Create Equipment
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Equipment Modal */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange} size="lg">
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <input type="hidden" name="intent" value="update" />
              <input
                type="hidden"
                name="equipmentId"
                value={editingEquipment?.equipment_id || ""}
              />
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Edit Equipment</h2>
                <p className="text-sm text-gray-500">
                  {editingEquipment?.equipment_id}
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    name="name"
                    label="Equipment Name"
                    defaultValue={editingEquipment?.name}
                  />
                  <Textarea
                    name="description"
                    label="Description"
                    defaultValue={editingEquipment?.description}
                  />
                  <Select
                    name="status"
                    label="Status"
                    defaultSelectedKeys={
                      editingEquipment ? [editingEquipment.status] : []
                    }
                  >
                    <SelectItem key="available">Available</SelectItem>
                    <SelectItem key="booked">Booked</SelectItem>
                    <SelectItem key="in_use">In Use</SelectItem>
                    <SelectItem key="maintenance">Maintenance</SelectItem>
                    <SelectItem key="delivered">Delivered</SelectItem>
                  </Select>
                  <Input
                    name="hourly_rate"
                    label="Hourly Rate (GHS)"
                    type="number"
                    defaultValue={String(editingEquipment?.hourly_rate || 70)}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" isLoading={isSubmitting}>
                  Save Changes
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
