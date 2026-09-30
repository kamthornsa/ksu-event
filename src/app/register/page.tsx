import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="register" />
    </main>
  );
}