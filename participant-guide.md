# Filter Agents by Status

## What You Will Build

Add a Status filter to the Agents page. Select Ready to hide agents whose
current configuration is still being prepared or has failed. Select several
statuses to see their combined results. Clear the selection to see all agents.

Install kagent with Substrate, then build and test the UI filter using the
existing Agent status. Move the revision-state calculation into the controller,
return it through the API, and update the UI to use it. Deploy the controller
and UI, then verify the response and filter together. No database or CRD change
is needed.

Follow the chapters in order. Start each command block in the directory shown
above it.

### The 1.x Pieces Behind the Page

- An AgentTemplate defines behavior: model, prompt, tools, and skills.
- A Harness defines execution: runtime, WorkerPool, and snapshot location.
- An Agent pairs the template with the Harness. The controller prepares a revision and reports its status.
- A Session is a conversation pinned to a successful revision. Substrate runs its Actor on a Worker.

Between turns, kagent uses Data snapshots to retain the Actor's durable data
and release its Worker. On resume, containers restart with that data. A Session
can stay READY while its Actor is suspended. Use Agent revision status for
this filter.

The UI already computes these six states in `agentRevisionState`:

| Value | Label | Meaning |
| --- | --- | --- |
| `ready` | Ready | The current revision has been prepared successfully. |
| `updating` | Updating | A newer revision is being prepared; an earlier one exists. |
| `updateFailed` | Update failed | A later edit failed; an earlier successful revision remains. |
| `preparing` | Preparing | The first revision is being prepared. |
| `failed` | Failed | Preparation failed before any successful revision. |
| `notReported` | No status | The controller has not reported a revision. |

An agent in Update failed can still start a conversation on its last successful
revision. Its current configuration is still not Ready. Reuse the existing
calculation so the filter and status display agree.

`EgressPoliciesApplied=False` reports rejected network grants separately; it
does not make a revision Failed. The Go calculation must preserve that rule.

### Start Here

- Choose your environment: **GitHub Codespaces in the browser** (no local
  installation) or **VS Code locally** with Docker and the Dev Containers
  extension. Both use the kagent Dev Container; you do not need to install
  Go, Node, Kubernetes tools, or build dependencies on your host.
- For Codespaces, open [kagent on GitHub](https://github.com/kagent-dev/kagent)
  and choose **Code > Codespaces**. For local VS Code, clone the repository
  and choose **Dev Containers: Reopen in Container**. Follow step 1 below
  before creating your workshop branch.
- Open separate integrated terminals for commands, Vite, and port-forwards.
  Use the source commit and development `VERSION` shown in this guide.
- Continue with step 1 below to check out the pinned workshop source. The
  cluster is prepared, but kagent itself is built and installed during the lab.
- Once installation completes, confirm controller/UI rollouts succeed, WorkerPool capacity is ready, and the mock Agents page displays rows.
- If downloads or builds stall on conference Wi-Fi, ask the presenter for help and use the mock-only route below. Buf can also rate-limit generation on a shared network.

For the mock-only route, clone the pinned source, install UI dependencies,
and start with fixtures. You can skip the controller forward.
Complete Add the Filter Function, Test the Function, and Connect the
Filter to the Page, then the fixture checks in Verify the UI Against kagent.
You can also write and unit-test the Go calculation without a cluster. Pair
with the presenter or someone whose stack is running for live API and
deployment steps. Verify those steps against a running stack; mock results
alone cannot confirm a deployment.

## Install kagent and Substrate

Set up the cluster during the workshop. Use the cloned repository's Makefile
and Kind scripts so the controller, charts, CLI, runtime images, and Substrate
come from the same source configuration.

The Dev Container includes Docker CLI/Buildx, Kind, kubectl, Helm 3, Git, Make,
jq, envsubst, Go, uv, Node/Corepack with Yarn 4.9.0, and grpcurl. Codespaces
runs the environment remotely; local Dev Containers require Docker running
on your machine. If you do not use the Dev Container, install Docker
with Buildx, Kind, kubectl, Helm 3, Git, Make, jq, envsubst, uv 0.10.4+, the Go
toolchain specified by `go/go.mod`, Node 24.13+, Corepack/Yarn 4.9.0, and
grpcurl. Follow the pinned checkout's `DEVELOPMENT.md` for the remaining
build-tool versions.

### 1. Get the Source

The workshop source is upstream `main` commit
`ccb2dd350e06be990618f3e464fbb07d0d67ca3d` (2026-11-06). Use this commit for
both the code examples and the installation. Clone the default branch and
launch the Dev Container first, so it uses the updated `.devcontainer`
configuration from `main` and prepares the cluster automatically.

#### Option A: GitHub Codespaces in Your Browser

You need a GitHub account with Codespaces access and available quota or
billing. No local Docker, Git, or VS Code installation is required.

1. Open [kagent on GitHub](https://github.com/kagent-dev/kagent).
2. Select **Code > Codespaces > ... > New with options**.
3. Select the branch containing the presenter's workshop Dev Container
   updates. Use `main` only after those updates have been merged there.
4. Choose a machine with enough CPU, memory, and disk for Kubernetes and image
   builds; prefer a larger machine over the smallest available option.
5. Select **Create codespace**. Wait for the browser editor, container build,
   and cluster setup to finish before running workshop commands.

Workshop readiness: the updated Dev Container must be published to the
selected branch first. The browser/Codespaces route has not yet been
rehearsed end to end; if setup fails, share the creation log with the
presenter or use the local option below. A successful editor launch alone
does not confirm that Docker and the cluster are ready.

#### Option B: Dev Containers in Local VS Code

Have Git, Docker Desktop (or another supported Docker engine), VS Code, and
the Dev Containers extension installed. Start Docker, then clone the repository
and open its root folder in VS Code:

```sh cwd=parent
git clone https://github.com/kagent-dev/kagent.git
cd kagent
```

In VS Code, run **Dev Containers: Reopen in Container** and wait for the image
build and cluster setup to finish. Use the branch containing the workshop
Dev Container updates if they have not yet been merged into `main`.

#### Continue Here for Either Option

Use the integrated terminal inside your Codespace or local Dev Container
for all remaining commands. Create your workshop branch at the pinned source:

```sh cwd=kagent
git switch -c contribfest-status-filter ccb2dd350e06be990618f3e464fbb07d0d67ca3d
```

The container automatically runs `make create-kind-cluster`. This creates the
`kagent` Kind cluster, local registry, and MetalLB. If that cluster already
exists, the setup reuses it rather than deleting it. If you already have this
container open from before the workshop setup was added, run
**Dev Containers: Rebuild Container** so the startup command runs. The startup
configures kubectl to reach the cluster API through Docker's host gateway.
For Codespaces, use **Codespaces: Rebuild Container** instead. Before rebuilding,
return to the branch containing the updated container configuration: the
older workshop source pin does not contain those updates.

Stop your Codespace when you finish to avoid using more compute quota.
Commit and push work you want to keep before deleting a Codespace.

If the presenter supplies a newer tested commit, use that one and its matching
instructions. Preserve existing local work when using a checkout you already own.

### 2. Check the Prepared Cluster

The Dev Container prepared the cluster during startup. Confirm it is ready:

```sh cwd=kagent
kubectl --context kind-kagent get nodes
kubectl --context kind-kagent api-resources --api-group=certificates.k8s.io
```

The startup target calls `scripts/kind/setup-kind.sh` and `setup-metallb.sh`.
It creates a local registry on `localhost:5001`, node pull routing to that
registry, and MetalLB. The default context is `kind-kagent`.

Use the cluster settings shipped with the pinned checkout. At this commit,
`KIND_IMAGE_VERSION` defaults to `1.35.0`, and `scripts/kind/kind-config.yaml`
enables the certificate feature gates and `certificates.k8s.io/v1beta1` APIs.
Confirm `PodCertificateRequest` and `ClusterTrustBundle` are listed. The newer
release-install docs describe Kubernetes 1.37 and v1 APIs; that is a different
installation baseline. Do not copy its node image into this recipe without
also checking the source scripts and matching Substrate version.

If a cluster named `kagent` existed before launch, the setup reuses it. Confirm
that it uses these settings and is not a 0.x installation before continuing.
Do not delete an existing cluster without checking whether you need its data.

### 3. Configure the Build and Provider

Use one development version for every build and install command. Set it in
each terminal where you run Make:

```sh cwd=kagent
export VERSION=0.0.0-contribfest
export MODEL_PROVIDER=openAI
printf 'OpenAI API key: '
read -r -s OPENAI_API_KEY
printf '\n'
export OPENAI_API_KEY
```

Enter your OpenAI API key at the hidden prompt in Bash or Zsh, in the shell
that will run the installer. The key is not part of the command history.
Follow the provider setup in the checkout's development guide
if using another provider. Keep credentials out of tracked files, command
history, screenshots, and the PR. The filter itself never invokes a model.

Check `make help AWK=awk` for available targets. Keep the default Docker registry,
repository, cluster name, and sandbox class for this lab unless the presenter
has tested overrides. Changing `KIND_CLUSTER_NAME` also changes the context
used by the later kubectl commands.

### 4. Build the Images

```sh cwd=kagent
make build VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
make build-img-versions VERSION="$VERSION" AWK=awk
```

`make build` builds and pushes the controller, UI, Go ADK, native Harness, and
sandbox images to the local registry for your machine's architecture. It also
writes runtime-image digest metadata under `build/runtime-images/`. The chart
preparation step needs those digests, so building only the UI or controller
is not sufficient for the first installation.

The build targets also run remote protobuf generation.
`BUILD_PROTO_GENERATE=` skips that step for the initial build, which uses the
generated code already committed in the checkout. `AWK=awk` supplies the parser
used to read the Go and Substrate versions, including when an empty environment
variable would prevent the Makefile's default from taking effect.

Only skip automatic generation when generated code is current. The backend
chapter explicitly regenerates it after changing `agents.proto`. Buf remote
generation has a separate rate limit; do not repeatedly retry a quota failure.
See the recovery instructions in that chapter if it happens.

### 5. Install from the Checkout

Before the first install, check the CRD chart for artifacts left from older
checkouts. Prepare the local charts, then render the CRD names:

```sh cwd=kagent
make helm-dev VERSION="$VERSION" AWK=awk
helm template kagent-crds ./helm/kagent-crds --namespace kagent | grep '^  name:'
```

At this revision, every CRD name in that chart should end in `.api.kagent.dev`.
Substrate CRDs belong to a separate `substrate-crds` release in `ate-system`.
If the output includes `.ate.dev` or `mcpservers.kagent.dev`, stop: inspect
`helm/kagent-crds/charts/` for old dependency archives. An existing checkout
can retain ignored chart downloads across branch changes. Back up stale,
untracked archives before removing them; do not delete tracked chart sources.

Helm can render these leftover archives even though the current Chart template
does not declare them. Installing that mixed bundle gives Substrate CRDs the
wrong owner and makes the CLI's separate Substrate CRD install fail.

Once the rendered chart contains only kagent CRDs:

```sh cwd=kagent
make kagent-cli-deploy VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
```

The target:

- Runs `use-kind-cluster`, which writes `/tmp/kind-config`, merges the Kind context into your kubeconfig, and sets its default namespace to `kagent`.
- Builds `go/core/bin/kagent-local` from this checkout.
- Runs `helm-dev` to prepare local charts with the built runtime-image digests.
- Creates local values/configuration files in `go/core/bin/`, including the Kind registry routing for Substrate.
- Uses the local CLI to install kagent, Substrate, certificate infrastructure, and the development PostgreSQL database.

The target selects the Substrate version from the checkout's Go dependency.
Use this checkout's CLI. The target also changes your kubeconfig; inspect
existing contexts before running it on a machine used for other clusters.

If the target fails because `~/.kube/config` does not exist, create a private
file for this new Kind cluster before retrying. Kind exports and merges its
context without replacing unrelated contexts:

```sh cwd=kagent
kind export kubeconfig --name kagent
chmod 600 "$HOME/.kube/config"
make kagent-cli-deploy VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
```

Do not run broad Docker cleanup commands.

If a previous attempt already installed a mixed CRD release, cleaning local
files is not enough. Inspect `helm list --all-namespaces --all` and count the
custom resources before choosing a recovery. On a confirmed disposable,
partial installation with no custom resources, remove the partial
`kagent-crds` release, then rerun the corrected installer. Uninstalling this
release deletes its CRDs and any objects using them. Get approval first;
do not force Helm ownership annotations or use this cleanup on a shared cluster.

`make kagent-cli-install VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=`
runs the same deployment target, then opens the dashboard and holds its
forward. Run the initial `make build` first. This guide uses
`kagent-cli-deploy` to keep installation and browser access separate.

### 6. Check the Installation

```sh cwd=any
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-controller --timeout=300s
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-ui --timeout=300s
kubectl --context kind-kagent -n kagent get pods
kubectl --context kind-kagent -n kagent get workerpools
```

Check for ready WorkerPool capacity as well as running controller/UI pods.
The target definitions and scripts were checked at the pinned commit.
Cluster creation and full installation have not been run for this kit.
The presenter must rehearse both before the event.

If a rollout times out, collect these before asking for help:

```sh cwd=any
kubectl --context kind-kagent -n kagent get pods
kubectl --context kind-kagent -n kagent get events --sort-by=.lastTimestamp
kubectl --context kind-kagent -n kagent logs deployment/kagent-controller --tail=100
kubectl --context kind-kagent -n ate-system get pods
```

Share the failed command and relevant error. Keep environment dumps, Secrets,
and kubeconfigs private. For a failing pod, inspect its events with
`kubectl --context kind-kagent -n kagent describe pod <pod-name>`.

## Run the UI and Get Test Data

### Keep These Terminals Separate

| Terminal | Working directory | Purpose | Address |
| --- | --- | --- | --- |
| Commands | kagent root; `ui/` for Yarn; `go/` for Go tests | Edits, tests, builds, and kubectl | No server |
| Controller forward | Any directory | Keep the controller reachable from Vite and grpcurl | `127.0.0.1:8083` |
| Vite | `kagent/ui` | Local UI; restart when changing mock mode | Printed URL, usually `127.0.0.1:8001` |
| Deployed UI forward | Any directory | Inspect the packaged UI after rollout | `127.0.0.1:8082` |

Mock mode needs only Vite. Live mode needs Vite and the controller forward.
Port 8082 shows the deployed image. Use Vite on 8001 to see local source edits.
Keep long-lived
commands running until the guide says to restart or stop them. If a port is
occupied, stop your earlier forward/server or ask the presenter before changing
it; changing the controller port also requires updating Vite's proxy target.

In Codespaces, open the editor's **Ports** tab and use **Open in Browser**
for port **8001** (Vite) or **8082** (the deployed UI). Add the port manually
if it is not listed. Use the forwarded HTTPS URL, not `localhost` in your
laptop's browser, and append `/agents` if needed. Keep port visibility
**Private**. Port **8083** is used by Vite and grpcurl inside the environment;
it does not need to be exposed publicly. Locally, use the localhost URLs below.

### 1. Start the Controller Forward

Keep this running in a separate terminal:

```sh cwd=any
kubectl --context kind-kagent -n kagent port-forward --address 127.0.0.1 svc/kagent-controller 8083:8083
```

### 2. Install UI Dependencies

From the kagent checkout:

```sh cwd=kagent
cd ui
corepack yarn --version
corepack yarn install --immutable
```

The version command should print `4.9.0` for this checkout. Use `corepack yarn`
throughout the lab so a global Yarn 1 executable cannot take precedence.

The next UI chapters use `kagent/ui` as their working directory. The backend
chapters will say when to return to the source root or Go module. The filter
reuses `FilterBar` and `useListView`, so no new UI dependencies are needed.

### 3. Start with Fixtures

```sh cwd=kagent/ui
KAGENT_UI_ENABLE_MOCK=true corepack yarn dev --host 127.0.0.1
```

Open the printed URL, normally `http://localhost:8001/agents`. This mode uses
in-browser fixtures and lets you test rendering without waiting for real
agent revisions. Later, you will switch mock mode off to verify the API path.

Open `src/pages/AgentsPage.tsx`. Locate `FILTER_IDS`, the `filtered` calculation,
and the `<FilterBar>` element. The existing namespace filter shows how the new
status filter connects to URL state and pagination.

## Add the Filter Function

Open `ui/src/api/domain/agents.ts` in the source checkout. Add this function
after `agentRevisionState`:

<!-- lab:helper -->
```ts
export function matchesAgentStatus(
  agent: Agent,
  selected: readonly string[],
): boolean {
  return selected.length === 0 || selected.includes(agentRevisionState(agent));
}
```

An empty selection includes every agent. Otherwise the agent must match one
of the selected states. The function only reads its inputs.

`src/api/index.ts` already re-exports `./domain/agents`, so leave it unchanged.
Pages import the function through `@/api`.

## Test the Function

Open `ui/src/api/domain/agents.test.ts`. Replace its import from `./agents`
with this import; leave the other imports and existing tests in place:

<!-- lab:test-import -->
```ts
import {
  agentDescription,
  agentRevisionState,
  matchesAgentStatus,
  newConversationBlockedReason,
  type Agent,
  type AgentStatus,
} from "./agents";
```

The file already defines an `agent(status?)` test helper. Append these tests
after the existing `describe` block:

<!-- lab:tests -->
```ts
describe("Agent status filter", () => {
  it("includes every agent when nothing is selected", () => {
    expect(matchesAgentStatus(agent(), [])).toBe(true);
  });

  it("includes a ready agent", () => {
    const row = agent({ desiredRevision: "good", latestSuccessfulRevision: "good" });
    expect(matchesAgentStatus(row, ["ready"])).toBe(true);
  });

  it("excludes an agent whose first revision is still preparing", () => {
    const row = agent({ desiredRevision: "new" });
    expect(matchesAgentStatus(row, ["ready"])).toBe(false);
  });

  it("matches any selected state", () => {
    const row = agent({ desiredRevision: "new" });
    expect(matchesAgentStatus(row, ["ready", "preparing"])).toBe(true);
  });

  it("keeps a failed update out of Ready even when an older revision can run", () => {
    const row = agent({
      desiredRevision: "new",
      latestSuccessfulRevision: "good",
      conditions: [{ type: "Compatible", status: "False" }],
    });
    expect(matchesAgentStatus(row, ["ready"])).toBe(false);
    expect(matchesAgentStatus(row, ["updateFailed"])).toBe(true);
  });

  it("matches agents without reported status", () => {
    expect(matchesAgentStatus(agent(), ["notReported"])).toBe(true);
  });
});
```

From `kagent/ui`, run:

```sh cwd=kagent/ui
corepack yarn test src/api/domain/agents.test.ts
```

Expect the existing readiness tests and all six new filter tests to pass.
If a test fails, fix the function before editing the page. A compile error or
`no tests to run` is not a pass.

## Connect the Filter to the Page

All three edits below are in `ui/src/pages/AgentsPage.tsx`.

### 1. Import and Register the Filter

In the existing import from `@/api`, add `matchesAgentStatus` beside
`agentRevisionState`:

```ts
  agentRevisionState,
  matchesAgentStatus,
```

Replace the `FILTER_IDS` declaration with:

<!-- lab:filter-ids -->
```ts
const FILTER_IDS: readonly string[] = ["ns", "status"];
```

Register the ID so the list-view hook clears this filter, saves its selection
in the URL, and resets pagination when it changes.

### 2. Apply the Selection

Replace the complete `const filtered = useMemo(...)` block with:

<!-- lab:filtered -->
```ts
  const filtered = useMemo(() => {
    const matching = agents.filter((agent) =>
      matchesAgentStatus(agent, view.selected("status")) &&
      matchesQuery(view.query, [
        agent.name,
        agent.namespace,
        templateRefName(agent),
        harnessRefName(agent),
        descriptions.get(agent.ref),
      ]),
    );
    if (!view.sort) matching.sort((left, right) => left.name.localeCompare(right.name));
    return matching;
  }, [agents, descriptions, view]);
```

The status and text filters must both match. Namespace filtering already
controls which agents are fetched. Keep the existing sort and pagination code.

### 3. Add the Control

In `<FilterBar>`, find the `filters` array. Insert this object immediately
after the existing namespace filter object, inside the same array:

<!-- lab:definition -->
```ts
          {
            id: "status",
            label: "Status",
            allLabel: "All statuses",
            options: [
              { value: "ready", label: "Ready" },
              { value: "updating", label: "Updating" },
              { value: "updateFailed", label: "Update failed" },
              { value: "preparing", label: "Preparing" },
              { value: "failed", label: "Failed" },
              { value: "notReported", label: "No status" },
            ],
          },
```

Save the file. Vite reloads the page. You should see All statuses beside the
namespace filter. Existing controls provide the selection pills and Clear filters.

```sh cwd=kagent/ui
corepack yarn test src/api/domain/agents.test.ts
corepack yarn typecheck
corepack yarn lint
```

## Return Revision State from the Controller

The filter currently calculates revision state in the browser. Add that same
calculation to the controller so API clients can use the controller's result.
Keep selection and pagination in the UI. Add a response field without changing
how the API filters results.

You need the Go toolchain from `go/go.mod` (Go 1.27.3 at this revision), Make,
and access to Buf's remote code-generation plugins. Run commands from the
kagent repository root unless stated otherwise.

### 1. Add the Go Calculation

Create `go/core/internal/service/agentstatus/status.go`:

<!-- lab:backend-helper -->
```go
package agentstatus

import (
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

  "github.com/kagent-dev/kagent/go/api/v1alpha3"
)

func RevisionState(agent *v1alpha3.Agent) string {
  if agent == nil {
    return "notReported"
  }
  status := agent.Status
  failed := false
  for _, condition := range status.Conditions {
    if condition.Status == metav1.ConditionFalse &&
      condition.Type != v1alpha3.AgentConditionEgressPoliciesApplied &&
      (condition.Type != "Ready" || condition.Reason != "ActorTemplatePending") {
      failed = true
    }
  }
  behind := status.ObservedGeneration < agent.Generation ||
    (status.DesiredRevision != "" && status.DesiredRevision != status.LatestSuccessfulRevision)
  if status.LatestSuccessfulRevision != "" {
    if failed {
      return "updateFailed"
    }
    if behind {
      return "updating"
    }
    return "ready"
  }
  if failed {
    return "failed"
  }
  if status.DesiredRevision != "" || behind {
    return "preparing"
  }
  return "notReported"
}
```

The handler calls this function. Test the calculation without a cluster or
database. It reads Agent status and leaves the stored Agent unchanged.

### 2. Add Go Tests

Create `go/core/internal/service/agentstatus/status_test.go`:

<!-- lab:backend-tests -->
```go
package agentstatus

import (
  "reflect"
  "testing"

  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

  "github.com/kagent-dev/kagent/go/api/v1alpha3"
)

func TestRevisionState(t *testing.T) {
  failure := []metav1.Condition{{Type: "Compatible", Status: metav1.ConditionFalse}}
  pending := []metav1.Condition{{Type: "Ready", Status: metav1.ConditionFalse, Reason: "ActorTemplatePending"}}
  cases := []struct {
    name       string
    generation int64
    status     v1alpha3.AgentStatus
    want       string
  }{
    {name: "no report", want: "notReported"},
    {name: "first revision", status: v1alpha3.AgentStatus{DesiredRevision: "new"}, want: "preparing"},
    {name: "ready", status: v1alpha3.AgentStatus{DesiredRevision: "good", LatestSuccessfulRevision: "good"}, want: "ready"},
    {name: "updating", status: v1alpha3.AgentStatus{DesiredRevision: "new", LatestSuccessfulRevision: "good", Conditions: pending}, want: "updating"},
    {name: "failed update", status: v1alpha3.AgentStatus{DesiredRevision: "new", LatestSuccessfulRevision: "good", Conditions: failure}, want: "updateFailed"},
    {name: "failed first revision", status: v1alpha3.AgentStatus{DesiredRevision: "new", Conditions: failure}, want: "failed"},
    {name: "pending golden snapshot", status: v1alpha3.AgentStatus{DesiredRevision: "new", Conditions: pending}, want: "preparing"},
    {name: "unobserved edit", generation: 2, status: v1alpha3.AgentStatus{ObservedGeneration: 1, DesiredRevision: "good", LatestSuccessfulRevision: "good"}, want: "updating"},
    {name: "Given a ready revision and rejected egress grants, when revision state is calculated, assert that it stays ready", status: v1alpha3.AgentStatus{DesiredRevision: "good", LatestSuccessfulRevision: "good", Conditions: []metav1.Condition{{Type: v1alpha3.AgentConditionEgressPoliciesApplied, Status: metav1.ConditionFalse}}}, want: "ready"},
    {name: "Given a first revision and rejected egress grants, when revision state is calculated, assert that it stays preparing", status: v1alpha3.AgentStatus{DesiredRevision: "new", Conditions: []metav1.Condition{{Type: v1alpha3.AgentConditionEgressPoliciesApplied, Status: metav1.ConditionFalse}}}, want: "preparing"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      agent := &v1alpha3.Agent{ObjectMeta: metav1.ObjectMeta{Generation: test.generation}, Status: test.status}
      before := agent.DeepCopy()
      if got := RevisionState(agent); got != test.want {
        t.Fatalf("RevisionState() = %q, want %q", got, test.want)
      }
      if !reflect.DeepEqual(agent, before) {
        t.Fatal("RevisionState() mutated the Agent")
      }
    })
  }
  if got := RevisionState(nil); got != "notReported" {
    t.Fatalf("RevisionState(nil) = %q", got)
  }
}
```

Run the focused tests before wiring the response:

```sh cwd=kagent
gofmt -w go/core/internal/service/agentstatus/status.go go/core/internal/service/agentstatus/status_test.go
cd go
go test ./core/internal/service/agentstatus -count=1 -v
cd ..
```

### 3. Add the Response Field and Generate Clients

Open `proto/kagent/api/v1/agents.proto`. Replace only `message Agent` with:

<!-- lab:backend-proto -->
```proto
message Agent {
  ResourceReference ref = 1;

  // Complete Agent CR, including its inline or referenced configuration and status.
  StructuredObject resource = 2;

  // Current revision state: ready, updating, updateFailed, preparing, failed, or notReported.
  // Empty on controllers that predate this field.
  string revision_state = 3;
}
```

This adds a response field without changing existing field numbers or request
types. Run the repository's generators; do not edit generated Go or TypeScript
files by hand:

```sh cwd=kagent
make proto-lint proto-generate AWK=awk
```

Generation may update clients for other languages too. Include those generated
changes even though you will not edit the clients by hand.
For upstream review, also run the repository's protobuf compatibility check
against the agreed base revision.

If Buf returns `resource_exhausted: too many requests`, stop retrying. Remote
generation has a separate quota; unauthenticated requests share the source
IP's quota, which matters on conference Wi-Fi. Authenticate in your terminal:

```sh cwd=kagent
go run github.com/bufbuild/buf/cmd/buf@v1.72.0 registry login buf.build
```

Enter credentials only through Buf's own login flow. Authentication raises
the generation quota. If you still hit the limit, wait until the server's
retry/reset time. The presenter can provide already-generated
files for the exact changed proto as a fallback.

After login or quota reset, run `make proto-lint proto-generate AWK=awk` once
and confirm it completes. Do not skip this step after changing a proto.
Subsequent builds use `BUILD_PROTO_GENERATE=` to avoid regenerating the same
files on every build or CLI installation. The [Buf rate-limit docs](https://buf.build/docs/bsr/rate-limits/)
describe the current limits.

### 4. Wire the Existing Agent Mapper

Open `go/core/internal/grpcserver/agent.go`. Add this import:

```go
"github.com/kagent-dev/kagent/go/core/internal/service/agentstatus"
```

In `func (s *agentServer) agent(...)`, replace the returned `apiv1.Agent`
literal with:

<!-- lab:backend-mapper -->
```go
  return &apiv1.Agent{
    Ref:           &apiv1.ResourceReference{Namespace: agent.Namespace, Name: agent.Name},
    Resource:      resource,
    RevisionState: agentstatus.RevisionState(agent),
  }, nil
```

The shared mapper serves list, get, create, and update responses. Authorization
and pagination still follow their existing paths. The original resource stays
intact and no status is written back to Kubernetes.

### 5. Check the API Response with a Generated Client

Append this test to `go/core/internal/grpcserver/agent_test.go`. Its imports
already include the types and test helpers used here:

<!-- lab:backend-api-test -->
```go
func TestAgentServiceReportsRevisionState(t *testing.T) {
  ready := &v1alpha3.Agent{
    ObjectMeta: metav1.ObjectMeta{Namespace: "team", Name: "ready"},
    Status: v1alpha3.AgentStatus{DesiredRevision: "good", LatestSuccessfulRevision: "good"},
  }
  failed := &v1alpha3.Agent{
    ObjectMeta: metav1.ObjectMeta{Namespace: "team", Name: "failed"},
    Status: v1alpha3.AgentStatus{DesiredRevision: "new", Conditions: []metav1.Condition{
      {Type: "Compatible", Status: metav1.ConditionFalse},
    }},
  }
  client := apiv1.NewAgentServiceClient(newTemplateAndHarnessConnection(t, ready, failed))
  ctx := metadata.AppendToOutgoingContext(t.Context(), "x-user-id", "alice")
  listed, err := client.ListAgents(ctx, &apiv1.ListAgentsRequest{Namespace: "team"})
  require.NoError(t, err)
  states := map[string]string{}
  for _, agent := range listed.Agents {
    states[agent.Ref.Name] = agent.RevisionState
  }
  require.Equal(t, map[string]string{"ready": "ready", "failed": "failed"}, states)
  got, err := client.GetAgent(ctx, &apiv1.GetAgentRequest{
    Ref: &apiv1.ResourceReference{Namespace: "team", Name: "ready"},
  })
  require.NoError(t, err)
  require.Equal(t, "ready", got.Agent.RevisionState)
}
```

```sh cwd=kagent
gofmt -w go/core/internal/grpcserver/agent.go go/core/internal/grpcserver/agent_test.go
cd go
go test ./core/internal/service/agentstatus ./core/internal/grpcserver -run 'TestRevisionState$|TestAgentService' -count=1 -v
cd ..
```

After the focused tests pass, run tests for the full affected packages before
upstream review. Record failures separately; the wider gRPC suite covers other
features too.
If an envtest case reports a missing `etcd` executable, use the Go Makefile's
`envtest-path` target to obtain its assets and set `KUBEBUILDER_ASSETS` to the
printed path before rerunning. The focused tests above do not need envtest.

### 6. Read the Controller Value in the UI

In `ui/src/api/domain/agents.ts`, add this optional field to `interface Agent`:

```ts
  revisionState?: AgentRevisionState;
```

Add this function to the same file:

<!-- lab:backend-ui-parser -->
```ts
export function revisionStateFromApi(value: string): AgentRevisionState | undefined {
  switch (value) {
  case "ready":
  case "updating":
  case "updateFailed":
  case "preparing":
  case "failed":
  case "notReported":
    return value;
  default:
    return undefined;
  }
}
```

Change the beginning of `agentRevisionState` to the following, keeping the
existing calculation after it as a fallback for older controllers:

<!-- lab:backend-ui-state -->
```ts
export function agentRevisionState({ revisionState, resource: { metadata, status } }: Agent): AgentRevisionState {
  if (revisionState !== undefined) return revisionState;
```

Open `ui/src/api/grpc/operations.ts`. Replace its type-only import from
`../domain/agents` with:

```ts
import { revisionStateFromApi, type Agent, type AgentResource } from "../domain/agents";
```

Then replace `toAgent` with:

<!-- lab:backend-ui-mapper -->
```ts
function toAgent(agent: PbAgent): Agent {
  return {
  ref: refToString(agent.ref),
  namespace: agent.ref?.namespace ?? "",
  name: agent.ref?.name ?? "",
  resource: unwrap<AgentResource>(agent.resource, "AgentService", "Agent"),
  revisionState: revisionStateFromApi(agent.revisionState),
  };
}
```

The existing status display and your new filter both call `agentRevisionState`,
so both now use the controller value. Old controllers return an empty field;
the fallback keeps the UI working during the upgrade.

In `ui/src/api/domain/agents.test.ts`, add `revisionStateFromApi` to the
`./agents` import and append:

<!-- lab:backend-ui-tests -->
```ts
describe("Controller revision state", () => {
  it("uses the controller value before the compatibility fallback", () => {
  const row = agent();
  row.revisionState = "ready";
  expect(agentRevisionState(row)).toBe("ready");
  expect(matchesAgentStatus(row, ["ready"])).toBe(true);
  });

  it("accepts known states and ignores empty or unknown values", () => {
  expect(revisionStateFromApi("updateFailed")).toBe("updateFailed");
  expect(revisionStateFromApi("")).toBeUndefined();
  expect(revisionStateFromApi("futureState")).toBeUndefined();
  });
});
```

From `kagent/ui`:

```sh cwd=kagent/ui
corepack yarn test src/api/domain/agents.test.ts
corepack yarn typecheck
```

## Deploy the Updated Controller

Run these commands from the kagent repository root after generation and tests:

```sh cwd=kagent
export VERSION=0.0.0-contribfest
make build-controller VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
make kagent-cli-deploy VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
```

The first target builds and pushes the updated controller. The second runs
the same local-chart deployment used during setup. Keep the development
database, Substrate, and runtime-image metadata from that setup; the new field
needs no database migration or agent-runtime change.

Because the development image tag stays the same, explicitly restart the
controller after the deployment command finishes:

```sh cwd=any
kubectl --context kind-kagent -n kagent rollout restart deployment/kagent-controller
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-controller --timeout=300s
```

The install target sets image pull policy to Always, so replacement pods pull
the rebuilt image. A Helm upgrade alone can leave existing pods running when
the pod template has not changed. Repeat the build, deploy, restart, and
rollout check after later controller edits.

Restart the controller forward after the old pod is replaced:

```sh cwd=any
kubectl --context kind-kagent -n kagent port-forward --address 127.0.0.1 svc/kagent-controller 8083:8083
```

### Create an Agent to Inspect

The installer does not create Agent, AgentTemplate, or Harness resources.
Create a small test Agent before checking the list response. It deliberately
references missing resources, so it should become Failed after reconciliation;
it will not start a conversation or call a model.

```sh cwd=any
kubectl --context kind-kagent -n kagent apply -f - <<'YAML'
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata:
  name: workshop-pending
  namespace: kagent
spec:
  template:
    ref:
      name: workshop-missing-template
  harnessRef:
    name: workshop-missing-harness
YAML
kubectl --context kind-kagent -n kagent get agent workshop-pending -o jsonpath='{.status.conditions}'
```

If admission rejects unresolved references at your revision, use the
presenter's prepared non-ready Agent instead; do not disable validation.

### Inspect the Response

The source chart disables gRPC reflection by default. From the kagent root,
create a descriptor set from your updated proto files, then use it with grpcurl:

```sh cwd=kagent
go run github.com/bufbuild/buf/cmd/buf@v1.72.0 build proto --as-file-descriptor-set -o /tmp/contribfest-api.binpb
grpcurl -plaintext -protoset /tmp/contribfest-api.binpb -d '{"namespace":"kagent"}' localhost:8083 kagent.api.v1.AgentService/ListAgents
```

Check for `revisionState` beside each returned Agent's `ref` and `resource`.
The test Agent should report `failed` once its unresolved references are
recorded; immediately after creation it may report `notReported` or `preparing`.
An empty namespace can return only `{"page":{}}`: protobuf JSON omits the
empty Agent array. That response confirms the RPC succeeded, but cannot verify
the new field. Check `kubectl get agents.api.kagent.dev -n kagent` if it is empty.

An old controller can still satisfy the UI fallback, so the filter working
alone does not prove that the backend change is deployed. The descriptor-set
command does not need reflection. Keep the controller bound to loopback.

## Verify the UI Against kagent

### 1. Check with Fixtures

On the Agents page:

1. Select Ready and check that every visible row has Ready status.
2. Select Preparing too; both statuses should now be included.
3. Use a namespace and text query at the same time. Results must match all three filters.
4. Reload the page. The status selection should remain in the URL and control.
5. Click Clear filters. All statuses should return.
6. Try a combination with no matches. Expect the existing filtered empty state, not the create-agent empty state.

### 2. Switch to the Cluster

Stop Vite with Ctrl-C. Keep the controller forward on 8083 running. Start Vite
again with mock mode explicitly disabled:

```sh cwd=kagent/ui
KAGENT_UI_ENABLE_MOCK=false corepack yarn dev --host 127.0.0.1
```

Check `ui/.env` for old backend URL overrides if reads fail. The default Vite
proxy targets `http://127.0.0.1:8083`. Kubernetes access and kagent API access
are separate; use the prepared cluster's identity settings if calls are denied.

### 3. Create Two Observable States

In the installed UI, prepare an agent with a valid Harness and template/model
configuration using the [1.x first-agent guide](https://kagent.dev/docs/kagent/1.x/get-started/your-first-agent/).
Wait for its successful revision. This gives you a Ready row without sending
a chat message.

Use the `workshop-pending` Agent created in the controller-deployment chapter
as the non-ready row. Inspect its conditions:

```sh cwd=any
kubectl --context kind-kagent -n kagent get agent workshop-pending -o jsonpath='{.status.conditions}'
```

The new row may initially show No status, then Failed after the controller
reports unresolved references. It must not appear when only Ready is selected.
Use the status shown by the page when testing the matching selection.

Compare the page with the Agent conditions and revisions. No model invocation
is needed to exercise the filter. Substrate still needs healthy Workers and
snapshot storage to prepare a valid agent revision.

## Build and Deploy the Updated UI

### 1. Build the Production Bundle

From `kagent/ui`:

```sh cwd=kagent/ui
corepack yarn build
```

This runs the type checker and builds the static bundle. It does not replace
the image in Kind.

### 2. Build and Push an Image

From the kagent repository root:

```sh cwd=kagent
export VERSION=0.0.0-contribfest
make build-ui VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
make kagent-cli-deploy VERSION="$VERSION" AWK=awk BUILD_PROTO_GENERATE=
```

The build target pushes the updated UI to the registry created during setup.
The deployment target reapplies the local charts with the same development
version and the controller image built in the previous chapter.

### 3. Restart the UI

As with the controller, restart the UI so new pods pull the rebuilt same-tag
image under the install target's Always pull policy:

```sh cwd=any
kubectl --context kind-kagent -n kagent rollout restart deployment/kagent-ui
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-ui --timeout=300s
```

Repeat the build, deploy, and restart sequence for later UI edits.

### 4. Open the Deployed Version

Stop any old UI forward and start this one:

```sh cwd=any
kubectl --context kind-kagent -n kagent port-forward --address 127.0.0.1 svc/kagent-ui 8082:8080
```

Open `http://localhost:8082/agents` and repeat the Ready/filter/clear checks.
Port 8082 serves the packaged UI. Confirm the image in use:

```sh cwd=any
kubectl --context kind-kagent -n kagent get deployment kagent-ui -o jsonpath='{.spec.template.spec.containers[*].image}'
```

If rollout fails, inspect pod events and logs. If a browser still shows the old
page, check its port, refresh, and confirm that the rollout replaced the UI
pod. These are development instructions for the disposable Kind cluster.

## Review and Contribute

From the source root:

```sh cwd=kagent
git status --short
git diff --check
git diff --stat
```

Review the UI files, new `agentstatus` package, Agent mapper/API test,
`agents.proto`, and generated clients. Keep install configuration, credentials,
and test manifests out of the PR. Confirm:

- The Go status and AgentService tests pass; the UI's 16 readiness/filter tests pass.
- The API response contains `revisionState` from the updated controller; the UI uses it, with a fallback for older controllers.
- Protobuf generation and compatibility checks pass; all affected generated clients are included.
- Type checking, lint, and the production build pass.
- Ready means the current revision is ready; a runnable older revision is not enough.
- Status selection works with search, namespaces, sorting, pagination, reload, and Clear filters.
- The filter works against the updated controller and from the deployed UI image.

Delete only the test Agent you created:

```sh cwd=any
kubectl --context kind-kagent -n kagent delete agent workshop-pending
```

Stop Vite and port-forwards with Ctrl-C. Keep the cluster if you want to
continue later. Before opening an upstream PR, check for existing work and
coordinate with a maintainer. Use signed-off commits (`git commit -s`) and list
the exact checks you ran, including any cluster steps you could not complete.
