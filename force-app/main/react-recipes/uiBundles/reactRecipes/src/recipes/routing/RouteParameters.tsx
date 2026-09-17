/**
 * Route Parameters
 *
 * An Account list links to a detail view using a dynamic route parameter
 * (:accountId). Clicking an account navigates to /route-parameters/:accountId,
 * whose route `loader` (accountLoader, below) reads the param and kicks off
 * the GraphQL fetch for that record.
 *
 * The loader returns its GraphQL promise WITHOUT awaiting it, so the route
 * transition is never blocked on the network call — navigation, the layout,
 * and the "Back to list" link all render immediately. The account panel
 * itself streams in via <Suspense>/<Await> once the promise resolves. This
 * is React Router's deferred-data pattern for non-blocking loaders.
 *
 * LWC equivalent: read the record ID from @wire(CurrentPageReference) via
 * pageRef.state.recordId, then fetch async without blocking render — akin to
 * an imperative Apex call that populates a template `if:true` block once it
 * resolves, rather than a blocking @wire(getRecord).
 *
 * Click an Account name to navigate to /route-parameters/:accountId
 * and load that record's detail view.
 *
 * @see NestedRoutes — master-detail layout with shared outlet context
 */
import { Suspense, useEffect, useState } from 'react';
import { Await, Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { createDataSDK, gql } from '@salesforce/platform-sdk';

const LIST_QUERY = gql`
  query AccountsForRouting {
    uiapi {
      query {
        Account(first: 5, orderBy: { Name: { order: ASC } }) {
          edges {
            node {
              Id
              Name @optional {
                value
              }
              Industry @optional {
                value
              }
            }
          }
        }
      }
    }
  }
`;

const DETAIL_QUERY = gql`
  query AccountById($id: ID) {
    uiapi {
      query {
        Account(where: { Id: { eq: $id } }, first: 1) {
          edges {
            node {
              Id
              Name @optional {
                value
              }
              Industry @optional {
                value
              }
              Phone @optional {
                value
              }
              Website @optional {
                value
              }
            }
          }
        }
      }
    }
  }
`;

interface ListResponse {
  uiapi: {
    query: {
      Account: {
        edges: Array<{
          node: {
            Id: string;
            Name: { value: string | null };
            Industry: { value: string | null };
          };
        }>;
      };
    };
  };
}

interface DetailResponse {
  uiapi: {
    query: {
      Account: {
        edges: Array<{
          node: {
            Id: string;
            Name: { value: string | null };
            Industry: { value: string | null };
            Phone: { value: string | null };
            Website: { value: string | null };
          };
        }>;
      };
    };
  };
}

/** Index route — list of accounts with links to the detail route */
export function RouteParametersList() {
  const [accounts, setAccounts] = useState<
    { id: string; name: string; industry: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const fetch = async () => {
      const sdk = await createDataSDK();
      const result = await sdk.graphql?.query<ListResponse>({ query: LIST_QUERY });

      if (result?.errors?.length) {
        throw new Error(
          result.errors.map((e: { message: string }) => e.message).join('; ')
        );
      }

      const edges = result?.data?.uiapi?.query?.Account?.edges ?? [];
      setAccounts(
        edges
          .map(edge => edge?.node)
          .filter(Boolean) // edges can contain null nodes in UIAPI — filter before mapping
          .map(node => ({
            id: node.Id,
            name: node.Name?.value ?? 'Unknown',
            industry: node.Industry?.value ?? null,
          }))
      );
    };

    fetch()
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Request failed')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm">Loading…</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <ul className="divide-y">
      {accounts.map(account => (
        <li key={account.id} className="py-2">
          <Link
            to={`/route-parameters/${account.id}`}
            className="text-sm text-primary hover:underline"
          >
            {account.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface AccountDetail {
  name: string;
  industry: string | null;
  phone: string | null;
  website: string | null;
}

/** Runs the actual GraphQL fetch — shared by the loader below. */
async function fetchAccount(accountId: string): Promise<AccountDetail> {
  const sdk = await createDataSDK();
  const result = await sdk.graphql?.query<DetailResponse>({
    query: DETAIL_QUERY,
    variables: { id: accountId },
  });

  if (result?.errors?.length) {
    throw new Error(
      result.errors.map((e: { message: string }) => e.message).join('; ')
    );
  }

  const node = result?.data?.uiapi?.query?.Account?.edges?.[0]?.node;
  if (!node) throw new Error('Not found.');

  return {
    name: node.Name?.value ?? 'Unknown',
    industry: node.Industry?.value ?? null,
    phone: node.Phone?.value ?? null,
    website: node.Website?.value ?? null,
  };
}

/**
 * Route loader for /route-parameters/:accountId.
 *
 * The `account` value is a Promise that is returned WITHOUT awaiting it here.
 * That's the key difference from a blocking loader: React Router starts this
 * navigation and renders <RouteParametersDetail /> immediately (nav, layout,
 * "Back to list" link, etc. are never held up), and only the account panel
 * itself waits — via <Suspense>/<Await> below — for the GraphQL call to
 * resolve. Awaiting the promise here would make the whole transition block
 * until data arrives, same as the previous useEffect approach.
 */
export function accountLoader({ params }: LoaderFunctionArgs) {
  return { account: fetchAccount(params.accountId!) };
}

/** Detail route — reads :accountId from the URL via the loader, then streams in that record */
export function RouteParametersDetail() {
  const { account } = useLoaderData() as { account: Promise<AccountDetail> };

  return (
    <div>
      <Link
        to="/routing"
        className="text-xs text-primary mb-2 inline-block hover:underline"
      >
        ← Back to list
      </Link>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Await
          resolve={account}
          errorElement={<p className="text-destructive">Request failed</p>}
        >
          {(resolved: AccountDetail) => (
            <div className="rounded-md bg-muted p-4 mt-2">
              <p className="text-lg font-semibold">{resolved.name}</p>
              {resolved.industry && (
                <p className="text-xs text-muted-foreground mt-1">
                  {resolved.industry}
                </p>
              )}
              {resolved.phone && (
                <p className="text-xs mt-1">
                  <a href={`tel:${resolved.phone}`} className="text-xs text-primary hover:underline">{resolved.phone}</a>
                </p>
              )}
              {resolved.website && (
                <p className="text-xs mt-1">
                  <a href={resolved.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    {resolved.website}
                  </a>
                </p>
              )}
            </div>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
