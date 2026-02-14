/**
 * Redirection /services/[id] → /partner/[id] (alias pour cohérence structure).
 */
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const rawId = context.params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return { notFound: true };
  return { redirect: { destination: `/partner/${id}`, permanent: true } };
};

export default function ServiceRedirect() {
  return null;
}
