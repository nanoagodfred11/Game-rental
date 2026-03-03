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
  Switch,
} from "@heroui/react";
import { Plus, Trash2, Tag, Percent, DollarSign, Clock } from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { PromoCode } from "~/models/promo-code.server";
import { promoCodeCreateSchema } from "~/lib/validation";
import { formatCurrency } from "~/lib/constants";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const promoCodes = await PromoCode.find().sort({ created_at: -1 }).lean();

  return {
    promoCodes: promoCodes.map((pc) => ({
      id: pc._id.toString(),
      code: pc.code,
      name: pc.name || "",
      description: pc.description || "",
      discount_type: pc.discount_type,
      discount_value: pc.discount_value,
      min_hours: pc.min_hours,
      max_discount: pc.max_discount,
      max_uses: pc.max_uses,
      max_uses_per_user: pc.max_uses_per_user,
      current_uses: pc.current_uses,
      first_booking_only: pc.first_booking_only,
      valid_from: pc.valid_from ? pc.valid_from.toISOString() : null,
      valid_until: pc.valid_until ? pc.valid_until.toISOString() : null,
      is_active: pc.is_active,
      created_at: pc.created_at.toISOString(),
    })),
  };
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const raw = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      discount_type: formData.get("discount_type") as string,
      discount_value: formData.get("discount_value") as string,
      min_hours: formData.get("min_hours") as string,
      max_discount: formData.get("max_discount") as string,
      max_uses: formData.get("max_uses") as string,
      max_uses_per_user: formData.get("max_uses_per_user") as string,
      allowed_emails: formData.get("allowed_emails") as string,
      first_booking_only: formData.get("first_booking_only") as string,
      valid_from: formData.get("valid_from") as string,
      valid_until: formData.get("valid_until") as string,
    };

    const result = promoCodeCreateSchema.safeParse(raw);
    if (!result.success) {
      return { error: result.error.issues[0].message, intent };
    }

    const existing = await PromoCode.findOne({
      code: result.data.code.toUpperCase(),
    });
    if (existing) {
      return { error: "Promo code already exists", intent };
    }

    const allowedEmails = result.data.allowed_emails
      ? result.data.allowed_emails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      : [];

    await PromoCode.create({
      code: result.data.code.toUpperCase(),
      name: result.data.name,
      description: result.data.description,
      discount_type: result.data.discount_type,
      discount_value: result.data.discount_value,
      min_hours: result.data.min_hours,
      max_discount: result.data.max_discount,
      max_uses: result.data.max_uses,
      max_uses_per_user: result.data.max_uses_per_user,
      allowed_emails: allowedEmails,
      first_booking_only: result.data.first_booking_only,
      valid_from: result.data.valid_from
        ? new Date(result.data.valid_from)
        : new Date(),
      valid_until: result.data.valid_until
        ? new Date(result.data.valid_until)
        : undefined,
      is_active: true,
      created_by: admin.email,
    });

    return { success: "Promo code created successfully", intent };
  }

  if (intent === "toggle") {
    const codeId = formData.get("codeId") as string;

    const promoCode = await PromoCode.findById(codeId);
    if (!promoCode) {
      return { error: "Promo code not found", intent };
    }

    promoCode.is_active = !promoCode.is_active;
    await promoCode.save();

    return {
      success: `Promo code ${promoCode.is_active ? "activated" : "deactivated"}`,
      intent,
    };
  }

  if (intent === "delete") {
    const codeId = formData.get("codeId") as string;

    const promoCode = await PromoCode.findByIdAndDelete(codeId);
    if (!promoCode) {
      return { error: "Promo code not found", intent };
    }

    return { success: "Promo code deleted", intent };
  }

  return { error: "Invalid action", intent };
}

function formatDiscount(type: string, value: number): string {
  switch (type) {
    case "percentage":
      return `${value}%`;
    case "fixed":
      return formatCurrency(value);
    case "free_hours":
      return `${value} free hr${value > 1 ? "s" : ""}`;
    default:
      return String(value);
  }
}

function getDiscountIcon(type: string) {
  switch (type) {
    case "percentage":
      return <Percent className="h-3 w-3" />;
    case "fixed":
      return <DollarSign className="h-3 w-3" />;
    case "free_hours":
      return <Clock className="h-3 w-3" />;
    default:
      return <Tag className="h-3 w-3" />;
  }
}

export default function AdminPromoCodes() {
  const { promoCodes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const createModal = useDisclosure();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Promo Codes</h1>
          <p className="text-gray-500 mt-1">
            Create and manage promotional codes
          </p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="h-4 w-4" />}
          onPress={createModal.onOpen}
        >
          Create Promo Code
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
          <Table aria-label="Promo codes table" removeWrapper>
            <TableHeader>
              <TableColumn>CODE</TableColumn>
              <TableColumn>NAME</TableColumn>
              <TableColumn>DISCOUNT</TableColumn>
              <TableColumn>USAGE</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>VALID DATES</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No promo codes found">
              {promoCodes.map((pc) => (
                <TableRow key={pc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary-500" />
                      <span className="font-mono font-bold">{pc.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>{pc.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      startContent={getDiscountIcon(pc.discount_type)}
                    >
                      {formatDiscount(pc.discount_type, pc.discount_value)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {pc.current_uses}
                      {pc.max_uses ? ` / ${pc.max_uses}` : " (unlimited)"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      color={pc.is_active ? "success" : "default"}
                      variant="flat"
                    >
                      {pc.is_active ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-gray-500">
                      {pc.valid_from && (
                        <div>
                          From:{" "}
                          {new Date(pc.valid_from).toLocaleDateString("en-GB")}
                        </div>
                      )}
                      {pc.valid_until && (
                        <div>
                          Until:{" "}
                          {new Date(pc.valid_until).toLocaleDateString("en-GB")}
                        </div>
                      )}
                      {!pc.valid_until && <div>No expiry</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="codeId" value={pc.id} />
                        <Switch
                          size="sm"
                          isSelected={pc.is_active}
                          onChange={() => {}}
                          name="_toggle"
                          aria-label="Toggle active"
                        />
                        <Button
                          size="sm"
                          variant="light"
                          type="submit"
                          isLoading={isSubmitting}
                        >
                          {pc.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="codeId" value={pc.id} />
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          type="submit"
                          isLoading={isSubmitting}
                          startContent={<Trash2 className="h-3 w-3" />}
                        >
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Create Promo Code Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onOpenChange={createModal.onOpenChange}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <Form method="post" onSubmit={() => setTimeout(onClose, 100)}>
              <input type="hidden" name="intent" value="create" />
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Create Promo Code</h2>
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    name="code"
                    label="Code"
                    placeholder="e.g. WELCOME20"
                    isRequired
                    className="uppercase"
                  />
                  <Input
                    name="name"
                    label="Name"
                    placeholder="e.g. Welcome Discount"
                    isRequired
                  />
                  <div className="col-span-2">
                    <Textarea
                      name="description"
                      label="Description"
                      placeholder="Describe what this promo code offers"
                    />
                  </div>
                  <Select
                    name="discount_type"
                    label="Discount Type"
                    isRequired
                    defaultSelectedKeys={["percentage"]}
                  >
                    <SelectItem key="percentage">Percentage (%)</SelectItem>
                    <SelectItem key="fixed">Fixed Amount (GHS)</SelectItem>
                    <SelectItem key="free_hours">Free Hours</SelectItem>
                  </Select>
                  <Input
                    name="discount_value"
                    label="Discount Value"
                    type="number"
                    isRequired
                    placeholder="e.g. 20"
                  />
                  <Input
                    name="min_hours"
                    label="Minimum Hours"
                    type="number"
                    defaultValue="1"
                  />
                  <Input
                    name="max_discount"
                    label="Max Discount (GHS)"
                    type="number"
                    placeholder="Optional cap"
                  />
                  <Input
                    name="max_uses"
                    label="Max Total Uses"
                    type="number"
                    placeholder="Unlimited if empty"
                  />
                  <Input
                    name="max_uses_per_user"
                    label="Max Uses Per User"
                    type="number"
                    defaultValue="1"
                  />
                  <Input
                    name="valid_from"
                    label="Valid From"
                    type="date"
                  />
                  <Input
                    name="valid_until"
                    label="Valid Until"
                    type="date"
                  />
                  <div className="col-span-2">
                    <Input
                      name="allowed_emails"
                      label="Allowed Emails (comma-separated)"
                      placeholder="Leave empty for all users"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <input
                      type="hidden"
                      name="first_booking_only"
                      value="false"
                    />
                    <Switch name="first_booking_only" value="true" size="sm">
                      First booking only
                    </Switch>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" isLoading={isSubmitting}>
                  Create Promo Code
                </Button>
              </ModalFooter>
            </Form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
