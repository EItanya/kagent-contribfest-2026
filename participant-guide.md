# Filter Agents by Status

## What You Will Build

Add a Status filter to the Agents page. Select Ready to hide agents whose
current configuration is still being prepared or has failed. Select several
statuses to see their combined results. Clear the selection to see all agents.

Build and test the filter with fixtures, then move the revision-state
calculation into the controller and return it through the API. Install your
updated controller and UI to verify them together. No database or CRD change
is needed.

Follow the chapters in order. Start each command block in the directory shown
above it.

### Agent Revision Status

- An AgentTemplate defines behavior: model, prompt, tools, and skills.
- A Harness defines execution: runtime, WorkerPool, and snapshot location.
- An Agent pairs the template with the Harness. The controller prepares a revision and reports its status.
- A Session is a conversation pinned to a successful revision. Its status is
  separate from the Agent revision status used by this filter.

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

Choose GitHub Codespaces in the browser or VS Code locally with Docker and
the Dev Containers extension. Both use the kagent Dev Container; you do not
need to install Go, Node, or Kubernetes tools on your host.

Follow the setup instructions in the next chapter.

## Prepare the Environment and Start Builds

The Dev Container prepares Kind and includes the workshop tools. Start the
runtime builds, then code while they run. Build and install the controller
and UI after completing the exercises.

### 1. Get the Source

The examples use commit `ccb2dd350e06be990618f3e464fbb07d0d67ca3d`
(2026-11-06). Launch the updated Dev Container before switching to this commit.

<!-- setup:codespaces -->
#### GitHub Codespaces

You need a GitHub account with Codespaces access and available quota or billing.

1. Open [kagent on GitHub](https://github.com/kagent-dev/kagent).
2. Select **Code > Codespaces > ... > New with options**.
3. Select the branch containing the presenter's workshop Dev Container
   updates. Use `main` only after those updates have been merged there.
4. Choose a larger machine for Kubernetes and image builds.
5. Select **Create codespace**. Wait for the browser editor, container build,
   and cluster setup to finish before running workshop commands.

<!-- setup:local -->
#### VS Code (Local)

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

<!-- setup:end -->
#### Continue Here for Either Option

Use the integrated terminal inside your Codespace or local Dev Container
for all remaining commands. Create your workshop branch at the pinned source:

```sh cwd=kagent
git switch -c contribfest-status-filter ccb2dd350e06be990618f3e464fbb07d0d67ca3d
```

### 2. Check the Prepared Cluster

Check the cluster created during container startup:

```sh cwd=kagent
kubectl --context kind-kagent get nodes
kubectl --context kind-kagent api-resources --api-group=certificates.k8s.io
```

Expect a Ready node and entries for `PodCertificateRequest` and
`ClusterTrustBundle`. If either check fails, ask the presenter before continuing.

### 3. Start the Runtime Builds While You Code

Run this in a separate terminal at the repository root, then continue to the
next chapter without waiting. No provider key is needed yet.

```sh cwd=kagent
make build-golang-adk build-claude-harness build-codex-harness VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=
```

The chart requires all three runtime images. Build them once.

## Run the UI and Get Test Data

### Keep These Terminals Separate

| Terminal | Working directory | Purpose | Address |
| --- | --- | --- | --- |
| Commands | kagent root; `ui/` for Yarn; `go/` for Go tests | Edits, tests, builds, and kubectl | No server |
| Runtime builds | kagent root | Build runtime images while you code | No server |
| Controller forward | Any directory | Keep the controller reachable from Vite and grpcurl | `127.0.0.1:8083` |
| Vite | `kagent/ui` | Local UI; restart when changing mock mode | Printed URL, usually `127.0.0.1:8001` |
| Deployed UI forward | Any directory | Inspect the packaged UI after rollout | `127.0.0.1:8082` |

Keep servers and port-forwards running in separate terminals. If a port is
occupied, stop the earlier process; changing port 8083 also requires changing
Vite's proxy target.

In Codespaces, open the editor's **Ports** tab and use **Open in Browser**
for port **8001** (Vite) or **8082** (the deployed UI). Add the port if missing
and append `/agents` to its HTTPS URL. Keep port visibility **Private**;
port **8083** only needs to be reachable inside the container.
Locally, use the localhost URLs below.

### 1. Use Mock Data

Use fixtures until kagent is installed. No controller forward is needed yet.

### 2. Install UI Dependencies

From the kagent checkout:

```sh cwd=kagent
cd ui
corepack yarn --version
corepack yarn install --immutable
```

Expect Yarn `4.9.0`. Use `corepack yarn` throughout the lab.

### 3. Start with Fixtures

```sh cwd=kagent/ui
KAGENT_UI_ENABLE_MOCK=true corepack yarn dev --host 127.0.0.1
```

Open the printed URL, normally `http://localhost:8001/agents`.

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

Expect the existing tests and all six new filter tests to pass before continuing.

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

Move the revision-state calculation to the controller and expose it in the
API response. Keep filtering and pagination in the UI.

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

This function reads Agent status without changing it.

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

Generate clients after adding the field:

```sh cwd=kagent
make proto-lint proto-generate AWK=awk
```

Keep all generated changes; do not edit them by hand. Later builds use
`BUILD_PROTO_GENERATE=` to reuse them. If Buf reports a quota error, ask the
presenter before retrying.

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

The shared mapper serves list, get, create, and update responses.

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

The status display and filter now use the controller value. The fallback
supports older controllers that return an empty field.

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

### 1. Wait for Builds and Configure the Provider

Finish the exercises and confirm that all three runtime builds succeeded.

The installer needs provider configuration even though the filter never calls
a model. In the terminal where you will run the installation:

```sh cwd=kagent
export MODEL_PROVIDER=openAI
printf 'OpenAI API key: '
read -r -s OPENAI_API_KEY
printf '\n'
export OPENAI_API_KEY
```

Enter your key at the hidden prompt in Bash or Zsh. Keep credentials out of
tracked files and screenshots. For another provider, follow the checkout's
development guide.

### 2. Build the Finished Images and Install Once

Build both images, then install only if both builds succeed:

```sh cwd=kagent
make build-controller build-ui VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE= &&
make kagent-cli-deploy VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=
```

The installer sets up the CLI, charts, PostgreSQL, Substrate, and certificates.
No separate UI production build or rollout restart is needed.

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

Create a test Agent with missing references. It should become Failed without
starting a conversation or calling a model.

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

Reuse the descriptor set unless the proto changes.

Check for `revisionState` beside each Agent's `ref` and `resource`. Expect
`failed` for the test Agent after reconciliation; it may briefly report
`notReported` or `preparing`. If the list is empty, check
`kubectl get agents.api.kagent.dev -n kagent`.

Verify the API field even if the UI works: its fallback also supports old
controllers.

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

Stop Vite with Ctrl-C, keep the controller forward running, and restart Vite
with mock mode disabled:

```sh cwd=kagent/ui
KAGENT_UI_ENABLE_MOCK=false corepack yarn dev --host 127.0.0.1
```

The Vite proxy targets the controller forward at `http://127.0.0.1:8083`.

### 3. Create Two Observable States

In the installed UI, prepare an agent with a valid Harness and template/model
configuration using the [1.x first-agent guide](https://kagent.dev/docs/kagent/1.x/get-started/your-first-agent/).
Wait for its successful revision; no chat message is needed.

Use the `workshop-pending` Agent created in the installation chapter
as the non-ready row. Inspect its conditions:

```sh cwd=any
kubectl --context kind-kagent -n kagent get agent workshop-pending -o jsonpath='{.status.conditions}'
```

Confirm the Ready filter hides `workshop-pending`. Select its displayed status
to show it again. Compare the page with the Agent conditions and revisions.
Preparing the valid Agent still requires healthy Substrate Workers and snapshot
storage.

## Verify the Packaged UI

Use the UI image already installed. No rebuild or reinstall is needed.

### 1. Open the Deployed Version

Start the UI forward in a separate terminal:

```sh cwd=any
kubectl --context kind-kagent -n kagent port-forward --address 127.0.0.1 svc/kagent-ui 8082:8080
```

Open `http://localhost:8082/agents` and repeat the Ready/filter/clear checks.
Port 8082 serves the packaged UI. Confirm the image in use:

```sh cwd=any
kubectl --context kind-kagent -n kagent get deployment kagent-ui -o jsonpath='{.spec.template.spec.containers[*].image}'
```

### 2. Only If You Make More Edits

Preview source edits in Vite without rebuilding images. To check a new
packaged UI, run
`make build-ui VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=`,
then `kubectl --context kind-kagent -n kagent rollout restart deployment/kagent-ui`
and await its rollout. Restart the UI forward after the old pod is replaced.

For a controller-only edit, use
`make build-controller VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=`
and restart/await only `deployment/kagent-controller`, then restart its forward.
Regenerate clients only if the proto changed. Rerun the installer only if
installation or chart configuration changed.
