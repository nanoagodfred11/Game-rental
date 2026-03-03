import { Form, Link, useActionData, useNavigation } from "react-router";
import { Input, Button } from "@heroui/react";
import { LogIn, Gamepad2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { loginSchema } from "~/lib/validation";
import { User } from "~/models/user.server";
import { verifyPassword } from "~/services/auth.server";
import { createUserSession, getUser } from "~/services/session.server";
import { redirect } from "react-router";
import { useState } from "react";

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  if (user) return redirect(user.role === "admin" ? "/admin" : "/equipment");
  return {};
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const result = loginSchema.safeParse(data);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors, error: null };
  }
  const { email, password } = result.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return { error: "Invalid email or password", errors: null };
  }
  if (!user.is_active) {
    return { error: "Account is deactivated", errors: null };
  }
  const valid = await verifyPassword(password, user.hashed_password);
  if (!valid) {
    return { error: "Invalid email or password", errors: null };
  }
  return createUserSession(user._id.toString(), user.role === "admin" ? "/admin" : "/equipment");
}

const inputClassNames = {
  input: "text-white",
  label: "text-gray-400",
  inputWrapper:
    "bg-white/5 border-white/10 hover:border-primary-500/50 group-data-[focus=true]:border-primary-500 transition-colors",
};

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);

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
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card gradient-border rounded-2xl p-6 md:p-8">
          <div className="flex flex-col items-center mb-6 md:mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-3 md:mb-4">
              <Gamepad2 className="w-7 h-7 md:w-8 md:h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome Back</h1>
            <p className="text-gray-400 mt-1.5 text-sm md:text-base">Sign in to your gaming account</p>
          </div>

          {actionData?.error && (
            <div className="bg-danger-50 text-danger-500 border border-danger-500/20 rounded-xl p-3 mb-6 text-sm text-center font-medium">
              {actionData.error}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-5">
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
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
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

            <Button
              type="submit"
              isLoading={isSubmitting}
              fullWidth
              className="bg-primary-500 text-white font-semibold neon-glow-cyan hover:bg-primary-400 mt-2"
              size="lg"
              startContent={!isSubmitting ? <LogIn className="w-4 h-4" /> : undefined}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </Form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Don&apos;t have an account?{" "}
            <Link to="/auth/register" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
