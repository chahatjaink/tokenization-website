import { IdentityReadError } from "@/domain/errors";

export function withDeadline<T>(ms: number, work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IdentityReadError("UPSTREAM_TIMEOUT"));
    }, ms);

    work().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
