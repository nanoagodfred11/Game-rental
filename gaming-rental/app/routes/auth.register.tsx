import { Form, Link, useActionData, useNavigation } from "react-router";
import { Input, Button } from "@heroui/react";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { registerSchema } from "~/lib/validation";
import { User } from "~/models/user.server";
import { hashPassword } from "~/services/auth.server";
import { createUserSession, getUser } from "~/services/session.server";
import { redirect } from "react-router";
import { useState } from "react";

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (user) return redirect("/equipment");
  return {};
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const result = registerSchema.safeParse(data);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null };
  }
  const { email, password, full_name, phone_number, hostel_name, room_number } = result.data;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return { error: "An account with this email already exists", errors: null };
  }
  const hashed = await hashPassword(password);
  const user = await User.create({
    email: email.toLowerCase(),
    hashed_password: hashed,
    full_name,
    phone_number,
    hostel_name,
    room_number,
  });
  return createUserSession(user._id.toString(), "/equipment");
}

const inputClassNames = {
  input: "text-white",
  label: "text-gray-400",
  inputWrapper:
    "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500 transition-colors",
};

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1920&q=80')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl relative z-10"
      >
        <div className="glass-card gradient-border rounded-2xl p-5 md:p-8">
          <div className="flex flex-col items-center mb-5 md:mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-500/10 flex items-center justify-center mb-3 md:mb-4">
              <UserPlus className="w-7 h-7 md:w-8 md:h-8 text-accent-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Create Account</h1>
            <p className="text-gray-400 mt-1.5 text-sm md:text-base">Join the gaming community</p>
          </div>

          {actionData?.error && (
            <div className="bg-danger-50 text-danger-500 border border-danger-500/20 rounded-xl p-3 mb-6 text-sm text-center font-medium">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-5">
            {/* Personal Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Personal Information</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="full_name"
                  type="text"
                  label="Full Name"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.full_name}
                  errorMessage={actionData?.errors?.full_name?.[0]}
                />

                <Input
                  name="email"
                  type="email"
                  label="Email Address"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.email}
                  errorMessage={actionData?.errors?.email?.[0]}
                />

                <Input
                  name="phone_number"
                  type="tel"
                  label="Phone Number"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.phone_number}
                  errorMessage={actionData?.errors?.phone_number?.[0]}
                />
              </div>
            </div>

            {/* Location Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Delivery Location</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="hostel_name"
                  type="text"
                  label="Hostel Name"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.hostel_name}
                  errorMessage={actionData?.errors?.hostel_name?.[0]}
                />

                <Input
                  name="room_number"
                  type="text"
                  label="Room Number"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.room_number}
                  errorMessage={actionData?.errors?.room_number?.[0]}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Security</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  description="Minimum 8 characters"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.password}
                  errorMessage={actionData?.errors?.password?.[0]}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-200 transition-colors focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <Input
                  name="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  label="Confirm Password"
                  isRequired
                  variant="bordered"
                  classNames={inputClassNames}
                  isInvalid={!!actionData?.errors?.confirm_password}
                  errorMessage={actionData?.errors?.confirm_password?.[0]}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="text-gray-400 hover:text-gray-200 transition-colors focus:outline-none"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              fullWidth
              className="bg-primary-500 text-white font-semibold neon-glow-cyan hover:bg-primary-400 mt-2"
              size="lg"
              startContent={!isSubmitting ? <UserPlus className="w-4 h-4" /> : undefined}
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>
          </Form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
