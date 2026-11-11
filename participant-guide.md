# Filter Agents by Status

## What You Will Build

Add a Status filter to the Agents page. Select Ready to hide agents whose
current configuration is still being prepared or has failed. Select several
statuses to see their combined results. Clear the selection to see all agents.

Start the required runtime-image builds, then build and test the UI filter
using fixtures while those builds run. Move the revision-state calculation
into the controller, return it through the API, and update the UI to use it.
Build the finished controller and UI once, install kagent with Substrate, and
verify the response and filter together. No database or CRD change is needed.

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
  cluster is prepared. Start the runtime builds, then continue coding without
  waiting for them. Install kagent only after the code changes are complete.

## Prepare the Environment and Start Builds

The Dev Container prepares Kind. In this chapter, start the required runtime
builds in a separate terminal, then continue to the UI exercises. Do not build
or install a baseline controller/UI: you will build the finished versions
and install once in Install the Updated Controller and UI.

The Dev Container includes the tools needed for the workshop.

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

The container automatically runs `make create-kind-cluster` to prepare the
`kagent` Kind cluster, local registry, and MetalLB.

### 2. Check the Prepared Cluster

The Dev Container prepared the cluster during startup. Confirm it is ready:

```sh cwd=kagent
kubectl --context kind-kagent get nodes
kubectl --context kind-kagent api-resources --api-group=certificates.k8s.io
```

Expect a Ready node and entries for `PodCertificateRequest` and
`ClusterTrustBundle`. If either check fails, ask the presenter before continuing.

### 3. Start the Runtime Builds While You Code

Open a **build terminal** at the repository root and run this once. Leave it
running while you continue to Run the UI and Get Test Data in another terminal.
No provider key or running kagent installation is needed yet.

```sh cwd=kagent
make build-golang-adk build-claude-harness build-codex-harness VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=
```

These three runtime images are required by the chart's image catalog. Build
them once; you will build the changed controller and UI after the code exercises.

Continue to the UI exercises now. No kagent deployment or API forward is
needed for fixtures, unit tests, or the Go status calculation.

## Run the UI and Get Test Data

### Keep These Terminals Separate

| Terminal | Working directory | Purpose | Address |
| --- | --- | --- | --- |
| Commands | kagent root; `ui/` for Yarn; `go/` for Go tests | Edits, tests, builds, and kubectl | No server |
| Runtime builds | kagent root | Let the one-time runtime builds finish while you code | No server |
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

### 1. Start with Mock Data, Not a Controller

Leave the runtime-build terminal running. Do not start a controller forward
yet: kagent is not installed and mock mode does not use it. You will start
that forward after the single installation later in the guide.

### 2. Install UI Dependencies

From the kagent checkout:

```sh cwd=kagent
cd ui
corepack yarn --version
corepack yarn install --immutable
```

The version command should print `4.9.0` for this checkout. Use `corepack yarn`
throughout the lab so a global Yarn 1 executable cannot take precedence.

Install dependencies once. The UI chapters use `kagent/ui` as their working
directory; the backend chapters say when to return to the source root or Go
module. No new UI dependencies are needed for the filter.

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

Run generation once after the proto edit. Subsequent builds use
`BUILD_PROTO_GENERATE=` to reuse the generated files. If Buf reports a quota
error, ask the presenter before retrying.

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

## Install the Updated Controller and UI

### 1. Finish the Warm-Up and Configure the Provider

Finish all code edits, generation, and focused tests first. Confirm that all
three builds in the runtime-build terminal succeeded.

The installer needs provider configuration even though the filter never calls
a model. In the terminal where you will run the installation:

```sh cwd=kagent
export MODEL_PROVIDER=openAI
printf 'OpenAI API key: '
read -r -s OPENAI_API_KEY
printf '\n'
export OPENAI_API_KEY
```

Enter your key at the hidden prompt in Bash or Zsh. The key is not part of the
command history. Follow the checkout's development guide for another provider.
Keep credentials out of tracked files, screenshots, and the PR.

### 2. Build the Finished Images and Install Once

Run from the kagent repository root. The `&&` prevents installation if either
image build fails:

```sh cwd=kagent
make build-controller build-ui VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE= &&
make kagent-cli-deploy VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=
```

This builds the controller and UI with your finished changes, then installs
them together. The UI Dockerfile runs `yarn build`, including type checking,
so no separate production build is needed. The installer prepares the CLI,
charts, PostgreSQL, Substrate, and certificate infrastructure.
No rollout restart is needed on this first installation.

### 3. Check the Installation

```sh cwd=any
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-controller --timeout=300s
kubectl --context kind-kagent -n kagent rollout status deployment/kagent-ui --timeout=300s
kubectl --context kind-kagent -n kagent get pods
kubectl --context kind-kagent -n kagent get workerpools
```

Confirm the controller/UI rollouts succeed and WorkerPool capacity is ready.
Ask the presenter if a check fails.

### 4. Start the Controller Forward

Keep this running in a separate terminal:

```sh cwd=any
kubectl --context kind-kagent -n kagent port-forward --address 127.0.0.1 svc/kagent-controller 8083:8083
```

### 5. Create an Agent to Inspect

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

### 6. Inspect the Response

The source chart disables gRPC reflection by default. From the kagent root,
create a descriptor set from your updated proto files, then use it with grpcurl:

```sh cwd=kagent
go run github.com/bufbuild/buf/cmd/buf@v1.72.0 build proto --as-file-descriptor-set -o /tmp/contribfest-api.binpb
grpcurl -plaintext -protoset /tmp/contribfest-api.binpb -d '{"namespace":"kagent"}' localhost:8083 kagent.api.v1.AgentService/ListAgents
```

Build the descriptor set once. Reuse it for later grpcurl checks unless the
proto changes; this is schema compilation, not another remote generation.

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

The Vite proxy targets the controller forward at `http://127.0.0.1:8083`.

### 3. Create Two Observable States

In the installed UI, prepare an agent with a valid Harness and template/model
configuration using the [1.x first-agent guide](https://kagent.dev/docs/kagent/1.x/get-started/your-first-agent/).
Wait for its successful revision. This gives you a Ready row without sending
a chat message.

Use the `workshop-pending` Agent created in the installation chapter
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

## Verify the Packaged UI

### 1. Reuse the Image Already Installed

The installation chapter already built and deployed your finished UI. Do not
run another `yarn build`, image build, CLI build, or Helm install just to open
it. Vite on port 8001 and the packaged UI on port 8082 are different checks
of the same source changes.

### 2. Open the Deployed Version

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

### 3. Only If You Make More Edits

Continue using Vite for UI iteration; no image rebuild is needed to preview
a source edit there. When you need to verify a new packaged UI, run only
`make build-ui VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=`,
then `kubectl --context kind-kagent -n kagent rollout restart deployment/kagent-ui`
and await its rollout. Restart the UI forward after the old pod is replaced.

For a controller-only edit, use
`make build-controller VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=`
and restart/await only `deployment/kagent-controller`, then restart its forward.
Reuse the installed database, Substrate, runtime images, and charts.
Only regenerate clients if the proto changed, and only rerun the installer
if installation/chart configuration changed.
