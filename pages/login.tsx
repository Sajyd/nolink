/**
 * Redirection vers /auth/signin (compatibilité URL courte).
 */
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const callbackUrl = (context.query.callbackUrl as string) || "";
  const url = callbackUrl ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/signin";
  return { redirect: { destination: url, permanent: true } };
};

export default function LoginRedirect() {
  return null;
}
