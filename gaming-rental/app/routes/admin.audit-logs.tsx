import {
  useLoaderData,
  useSearchParams,
  useNavigation,
  Form,
} from "react-router";
import {
  Card,
  CardBody,
  Button,
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
} from "@heroui/react";
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  FileText,
} from "lucide-react";
import { useState } from "react";

import { requireAdmin } from "~/services/session.server";
import { AuditLog } from "~/models/audit-log.server";

const PAGE_SIZE = 50;

const ACTION_TYPES = [
  "equipment_updated",
  "equipment_force_reset",
  "password_reset",
  "user_activated",
  "user_deactivated",
  "booking_status_changed",
  "payment_verified",
  "promo_code_created",
  "promo_code_deleted",
];

const TARGET_TYPES = [
  "equipment",
  "user",
  "booking",
  "payment",
  "promo_code",
  "review",
];

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const actionFilter = url.searchParams.get("action") || "";
  const targetTypeFilter = url.searchParams.get("target_type") || "";

  const query: Record<string, any> = {};
  if (actionFilter) {
    query.action = actionFilter;
  }
  if (targetTypeFilter) {
    query.target_type = targetTypeFilter;
  }

  const totalCount = await AuditLog.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const skip = (page - 1) * PAGE_SIZE;

  const logs = await AuditLog.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .lean();

  return {
    logs: logs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      actor_id: log.actor_id,
      actor_email: log.actor_email,
      actor_role: log.actor_role,
      target_type: log.target_type || "",
      target_id: log.target_id || "",
      details: log.details || {},
      previous_state: log.previous_state || {},
      new_state: log.new_state || {},
      ip_address: log.ip_address || "",
      created_at: log.created_at.toISOString(),
    })),
    page,
    totalPages,
    totalCount,
    actionFilter,
    targetTypeFilter,
  };
}

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    equipment_updated: "primary",
    equipment_force_reset: "warning",
    password_reset: "danger",
    user_activated: "success",
    user_deactivated: "danger",
    booking_status_changed: "secondary",
    payment_verified: "success",
    promo_code_created: "primary",
    promo_code_deleted: "danger",
  };

  return (
    <Chip size="sm" variant="flat" color={colorMap[action] || "default"}>
      {action.replace(/_/g, " ")}
    </Chip>
  );
}

export default function AdminAuditLogs() {
  const {
    logs,
    page,
    totalPages,
    totalCount,
    actionFilter,
    targetTypeFilter,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const detailsModal = useDisclosure();
  const [selectedLog, setSelectedLog] = useState<(typeof logs)[0] | null>(null);

  function handleFilterChange(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  }

  function handlePageChange(newPage: number) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(newPage));
    setSearchParams(newParams);
  }

  function handleViewDetails(log: (typeof logs)[0]) {
    setSelectedLog(log);
    detailsModal.onOpen();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-gray-500 mt-1">
            View system activity ({totalCount} total entries)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-surface-800 border border-white/10 mb-6">
        <CardBody className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select
              label="Action Type"
              placeholder="All actions"
              size="sm"
              className="max-w-[200px]"
              selectedKeys={actionFilter ? [actionFilter] : []}
              onChange={(e) => handleFilterChange("action", e.target.value)}
            >
              {ACTION_TYPES.map((action) => (
                <SelectItem key={action}>
                  {action.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Target Type"
              placeholder="All targets"
              size="sm"
              className="max-w-[200px]"
              selectedKeys={targetTypeFilter ? [targetTypeFilter] : []}
              onChange={(e) =>
                handleFilterChange("target_type", e.target.value)
              }
            >
              {TARGET_TYPES.map((type) => (
                <SelectItem key={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </Select>
            {(actionFilter || targetTypeFilter) && (
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  const newParams = new URLSearchParams();
                  setSearchParams(newParams);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Logs Table */}
      <Card className="bg-surface-800 border border-white/10">
        <CardBody className="p-0">
          <Table aria-label="Audit logs table" removeWrapper>
            <TableHeader>
              <TableColumn>TIMESTAMP</TableColumn>
              <TableColumn>ACTION</TableColumn>
              <TableColumn>ACTOR</TableColumn>
              <TableColumn>TARGET TYPE</TableColumn>
              <TableColumn>TARGET ID</TableColumn>
              <TableColumn>DETAILS</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent="No audit logs found"
              isLoading={isLoading}
            >
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(log.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      <br />
                      <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="text-sm">{log.actor_email}</span>
                      <br />
                      <span className="text-xs text-gray-400 capitalize">
                        {log.actor_role}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.target_type && (
                      <Chip size="sm" variant="flat">
                        {log.target_type}
                      </Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-gray-500">
                      {log.target_id
                        ? log.target_id.length > 16
                          ? `${log.target_id.slice(0, 16)}...`
                          : log.target_id
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Eye className="h-3 w-3" />}
                      onPress={() => handleViewDetails(log)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            size="sm"
            variant="flat"
            isDisabled={page <= 1}
            onPress={() => handlePageChange(page - 1)}
            startContent={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="flat"
            isDisabled={page >= totalPages}
            onPress={() => handlePageChange(page + 1)}
            endContent={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onOpenChange={detailsModal.onOpenChange}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Audit Log Details
                </h2>
                {selectedLog && (
                  <div className="flex items-center gap-2">
                    <ActionBadge action={selectedLog.action} />
                    <span className="text-sm text-gray-500">
                      {new Date(selectedLog.created_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                )}
              </ModalHeader>
              <ModalBody>
                {selectedLog && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Actor
                        </p>
                        <p className="font-medium">
                          {selectedLog.actor_email}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {selectedLog.actor_role}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Target
                        </p>
                        <p className="font-medium capitalize">
                          {selectedLog.target_type || "N/A"}
                        </p>
                        <p className="text-xs font-mono text-gray-400">
                          {selectedLog.target_id || "N/A"}
                        </p>
                      </div>
                    </div>

                    {selectedLog.ip_address && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          IP Address
                        </p>
                        <p className="font-mono text-sm">
                          {selectedLog.ip_address}
                        </p>
                      </div>
                    )}

                    {Object.keys(selectedLog.details).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">
                          Details
                        </p>
                        <pre className="p-3 bg-white/5 rounded-lg text-xs overflow-x-auto text-gray-300">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {Object.keys(selectedLog.previous_state).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">
                          Previous State
                        </p>
                        <pre className="p-3 bg-danger-500/10 rounded-lg text-xs overflow-x-auto text-danger-300">
                          {JSON.stringify(
                            selectedLog.previous_state,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                    {Object.keys(selectedLog.new_state).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">
                          New State
                        </p>
                        <pre className="p-3 bg-success-500/10 rounded-lg text-xs overflow-x-auto text-success-300">
                          {JSON.stringify(selectedLog.new_state, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
