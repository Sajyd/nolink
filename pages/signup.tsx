/**
 * Redirection vers /auth/register (compatibilité URL courte).
 */
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return { redirect: { destination: "/auth/register", permanent: true } };
};

export default function SignupRedirect() {
  return null;
}
