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

Start setup in the next chapter. While the environment and builds run, read
the two kagent chapters after it; skip them if you already know kagent 1.x.

## Prepare the Environment and Start Builds

The Dev Container prepares Kind and includes the workshop tools. Start the
runtime builds, then code while they run. Build and install the controller
and UI after completing the exercises.

### 1. Get the Source

Use the `main` branch for the workshop.

<!-- setup:codespaces -->
#### GitHub Codespaces

You need a GitHub account with Codespaces access and available quota or billing.

1. Open [kagent on GitHub](https://github.com/kagent-dev/kagent).
2. Select **Code > Codespaces > ... > New with options**.
3. Select the `main` branch.
4. Choose a larger machine for Kubernetes and image builds.
5. Select **Create codespace**. Wait for the browser editor, container build,
   and cluster setup to finish before running workshop commands.

<!-- setup:local -->
#### VS Code (Local)

Have Git, Docker Desktop (or another supported Docker engine), VS Code, and
the Dev Containers extension installed. Start Docker, then clone the repository
and open its root folder in VS Code:

```sh cwd=parent
git clone --branch main https://github.com/kagent-dev/kagent.git
cd kagent
```

In VS Code, run **Dev Containers: Reopen in Container** and wait for the image
build and cluster setup to finish.

<!-- setup:end -->
#### Continue Here for Either Option

Use the integrated terminal inside your Codespace or local Dev Container
for all remaining commands. Stay on `main`; no additional checkout is needed.

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
next chapters without waiting. No provider key is needed yet.

```sh cwd=kagent
make build-golang-adk build-claude-harness build-codex-harness VERSION=0.0.0-contribfest AWK=awk BUILD_PROTO_GENERATE=
```

The chart requires all three runtime images. Build them once.

## How kagent Works

kagent runs AI agents on Kubernetes. You describe an agent in YAML. kagent
turns that description into something ready to boot, gives each conversation
its own isolated copy of the agent, and puts that copy to sleep when the
conversation goes quiet.

This chapter introduces the pieces and follows one conversation through them.
The next chapter covers what this lab changes: how an Agent becomes ready and
how its status reports that.

<figure class="diagram" role="img" aria-label="Clients call the kagent controller. The controller reads agent resources from the Kubernetes API, stores conversations in PostgreSQL, and runs agents as Substrate Actors booted from a golden snapshot. An animated message travels from a client through the controller and wakes a suspended Actor.">
<svg viewBox="0 0 760 400" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-arrowhead"/></marker></defs>
<rect x="250" y="10" width="260" height="52" rx="6" class="d-box"/>
<text x="380" y="34" class="d-title">UI · CLI · other agents</text>
<text x="380" y="52" class="d-note">never talk to an agent directly</text>
<line x1="380" y1="62" x2="380" y2="118" class="d-line" marker-end="url(#arrow)"/>
<text x="390" y="95" class="d-label d-start">gRPC-Web · A2A · MCP</text>
<rect x="10" y="120" width="200" height="84" rx="6" class="d-box"/>
<text x="110" y="148" class="d-title">Kubernetes API</text>
<text x="110" y="170" class="d-note">Agent · AgentTemplate</text>
<text x="110" y="188" class="d-note">Harness · ModelConfig</text>
<rect x="280" y="120" width="200" height="84" rx="6" class="d-box d-focus d-pulse"/>
<text x="380" y="148" class="d-title">kagent controller</text>
<text x="380" y="170" class="d-note">prepares agents</text>
<text x="380" y="188" class="d-note">serves APIs · routes chats</text>
<rect x="550" y="120" width="200" height="84" rx="6" class="d-box"/>
<text x="650" y="148" class="d-title">PostgreSQL</text>
<text x="650" y="170" class="d-note">sessions · tasks</text>
<text x="650" y="188" class="d-note">conversation history</text>
<line x1="210" y1="162" x2="278" y2="162" class="d-line" marker-end="url(#arrow)"/>
<text x="244" y="154" class="d-label">watch</text>
<line x1="480" y1="162" x2="548" y2="162" class="d-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
<text x="514" y="154" class="d-label">store</text>
<line x1="380" y1="204" x2="380" y2="258" class="d-line" marker-end="url(#arrow)"/>
<text x="390" y="236" class="d-label d-start">prepare revisions · create and route to Actors</text>
<rect x="10" y="260" width="740" height="130" rx="8" class="d-group"/>
<text x="26" y="284" class="d-title d-start">Substrate</text>
<rect x="30" y="300" width="170" height="70" rx="6" class="d-box"/>
<text x="115" y="328" class="d-title">Golden snapshot</text>
<text x="115" y="348" class="d-note">one per revision</text>
<line x1="200" y1="335" x2="246" y2="335" class="d-line" marker-end="url(#arrow)"/>
<text x="223" y="327" class="d-label">boots</text>
<rect x="250" y="300" width="155" height="70" rx="6" class="d-box"/>
<text x="327" y="328" class="d-title">Actor</text>
<text x="327" y="348" class="d-note">session 1 · running</text>
<rect x="420" y="300" width="155" height="70" rx="6" class="d-box"/>
<text x="497" y="328" class="d-title">Actor</text>
<text x="497" y="348" class="d-note">session 2 · running</text>
<rect x="590" y="300" width="145" height="70" rx="6" class="d-box d-idle"/>
<rect x="590" y="300" width="145" height="70" rx="6" class="d-wake"/>
<text x="662" y="328" class="d-title">Actor</text>
<text x="662" y="348" class="d-note d-asleep">session 3 · suspended</text>
<text x="662" y="348" class="d-note d-awake">session 3 · running</text>
<circle r="7" class="d-message"/>
</svg>
<figcaption>A new message goes through the controller and wakes session 3's suspended Actor.</figcaption>
</figure>

### The Pieces

- **Controller.** The center of kagent and the component you will change in
  this lab. It watches the agent resources you apply, prepares them to run,
  and serves the APIs that the UI, CLI, and other programs use. Only the
  controller talks to Substrate.
- **UI and CLI.** Clients of the controller. The UI is a React app that calls
  the controller over gRPC-Web. The Agents page you will change gets its list
  of agents this way.
- **Substrate.** A separate project that runs agent processes. It runs each one
  as an **Actor**: an isolated runtime process with a private disk mounted at
  `/data`. Substrate can snapshot an Actor, suspend it, and resume it from that
  snapshot. Actors run on the workers of a Substrate **WorkerPool**.
- **Agent runtime.** The program inside an Actor: kagent's Go or Python ADK,
  Codex, Claude, or your own image.
- **PostgreSQL.** Stores everything that is not configuration: sessions,
  tasks, and conversation history. History lives here and not inside the
  Actor, so an Actor can be suspended or replaced without losing the
  conversation.

### Describing an Agent

You describe an agent with three `api.kagent.dev/v1alpha3` Kubernetes
resources. The split follows who usually owns each part:

- **AgentTemplate:** *what the agent does*. Model, system prompt, MCP tools,
  skills, and subagents. Agent authors write these.
- **Harness:** *how it runs*. One runtime (kagent, Codex, Claude, or your own
  image), the WorkerPool, and where snapshots are stored. Platform teams
  write these. `kagent install` creates three you can use right away:
  `kagent-default`, `codex-default`, and `claude-default`.
- **Agent:** the thing you chat with. It pairs one template, inline or by
  reference to an AgentTemplate, with one Harness through `harnessRef`. Its
  `status` reports whether it is ready.

Two supporting resources fill in the details: a **ModelConfig** names a model
provider and endpoint, and a **RemoteMCPServer** names a tool server agents can
use. The same template can run on any compatible Harness.

A minimal Agent with an inline template, running on a default Harness. You do
not need to apply it; the lab creates its own agents later.

```yaml
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata:
  name: assistant
  namespace: kagent
spec:
  template:
    inline:
      modelConfig:
        name: default-model-config
      description: A general-purpose assistant.
      systemPrompt: You are a helpful assistant running on kagent.
  harnessRef:
    name: kagent-default
```

### Following One Conversation

1. **You apply the Agent.** The controller compiles it into a **revision**,
   then has Substrate boot it once and save a **golden snapshot** of the
   started runtime. Until that succeeds, nobody can chat with the Agent. The
   next chapter covers this step.
2. **Someone starts a chat.** The controller creates a **Session**: a
   PostgreSQL record pinned to the Agent's latest successful revision, with its
   own Actor created from that revision.
3. **They send a message.** It goes to the controller over A2A, and the
   controller routes it to that Session's Actor. Clients never learn the
   Actor's address.
4. **The agent works.** The runtime calls the model and tools, saves task
   progress and history to PostgreSQL through the controller, and streams
   events back to the client.
5. **The conversation goes quiet.** Substrate suspends the Actor and saves its
   `/data` disk. The next message resumes it, so idle conversations use no
   compute.

<figure class="diagram" role="img" aria-label="Sequence diagram with four columns: Client, Controller, PostgreSQL, and Substrate. Step 1: you apply the Agent through Kubernetes; the controller compiles a revision and Substrate saves a golden snapshot. Step 2: a chat starts; the controller stores a Session pinned to the revision and creates an Actor. Step 3: a message arrives over A2A and the controller routes it to the Actor. Step 4: the Actor reports progress, the controller saves it and streams events to the client. Step 5: the idle Actor is suspended, and the next message resumes it. A highlight moves through the steps in order.">
<svg viewBox="0 0 760 425" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow-seq" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-arrowhead"/></marker></defs>
<rect x="8" y="60" width="744" height="76" rx="6" class="d-band d-band-1"/>
<rect x="8" y="140" width="744" height="66" rx="6" class="d-band d-band-2"/>
<rect x="8" y="210" width="744" height="52" rx="6" class="d-band d-band-3"/>
<rect x="8" y="266" width="744" height="70" rx="6" class="d-band d-band-4"/>
<rect x="8" y="340" width="744" height="78" rx="6" class="d-band d-band-5"/>
<rect x="40" y="10" width="140" height="40" rx="6" class="d-box"/><text x="110" y="35" class="d-title">Client</text>
<rect x="230" y="10" width="140" height="40" rx="6" class="d-box d-focus"/><text x="300" y="35" class="d-title">Controller</text>
<rect x="420" y="10" width="140" height="40" rx="6" class="d-box"/><text x="490" y="35" class="d-title">PostgreSQL</text>
<rect x="600" y="10" width="140" height="40" rx="6" class="d-box"/><text x="670" y="35" class="d-title">Substrate</text>
<line x1="110" y1="50" x2="110" y2="418" class="d-life"/>
<line x1="300" y1="50" x2="300" y2="418" class="d-life"/>
<line x1="490" y1="50" x2="490" y2="418" class="d-life"/>
<line x1="670" y1="50" x2="670" y2="418" class="d-life"/>
<circle cx="28" cy="98" r="11" class="d-badge"/><text x="28" y="102" class="d-badge-text">1</text>
<circle cx="28" cy="173" r="11" class="d-badge"/><text x="28" y="177" class="d-badge-text">2</text>
<circle cx="28" cy="236" r="11" class="d-badge"/><text x="28" y="240" class="d-badge-text">3</text>
<circle cx="28" cy="301" r="11" class="d-badge"/><text x="28" y="305" class="d-badge-text">4</text>
<circle cx="28" cy="379" r="11" class="d-badge"/><text x="28" y="383" class="d-badge-text">5</text>
<line x1="110" y1="85" x2="298" y2="85" class="d-line" marker-end="url(#arrow-seq)"/><text x="205" y="79" class="d-label">apply Agent (via Kubernetes)</text>
<line x1="300" y1="106" x2="668" y2="106" class="d-line" marker-end="url(#arrow-seq)"/><text x="310" y="100" class="d-label d-start">compile revision, boot it once</text>
<line x1="670" y1="127" x2="302" y2="127" class="d-line" marker-end="url(#arrow-seq)"/><text x="500" y="121" class="d-label d-start">golden snapshot saved</text>
<line x1="110" y1="160" x2="298" y2="160" class="d-line" marker-end="url(#arrow-seq)"/><text x="205" y="154" class="d-label">start chat</text>
<line x1="300" y1="179" x2="488" y2="179" class="d-line" marker-end="url(#arrow-seq)"/><text x="395" y="173" class="d-label">store pinned Session</text>
<line x1="300" y1="198" x2="668" y2="198" class="d-line" marker-end="url(#arrow-seq)"/><text x="500" y="192" class="d-label d-start">create Actor</text>
<line x1="110" y1="232" x2="298" y2="232" class="d-line" marker-end="url(#arrow-seq)"/><text x="205" y="226" class="d-label">message over A2A</text>
<line x1="300" y1="252" x2="668" y2="252" class="d-line" marker-end="url(#arrow-seq)"/><text x="500" y="246" class="d-label d-start">route to its Actor</text>
<line x1="670" y1="287" x2="302" y2="287" class="d-line" marker-end="url(#arrow-seq)"/><text x="500" y="281" class="d-label d-start">progress, history</text>
<line x1="300" y1="307" x2="488" y2="307" class="d-line" marker-end="url(#arrow-seq)"/><text x="395" y="301" class="d-label">save</text>
<line x1="300" y1="327" x2="112" y2="327" class="d-line" marker-end="url(#arrow-seq)"/><text x="205" y="321" class="d-label">stream events</text>
<rect x="585" y="348" width="170" height="28" rx="5" class="d-box d-idle"/><text x="670" y="367" class="d-note">idle: suspend, save /data</text>
<line x1="110" y1="402" x2="298" y2="402" class="d-line" marker-end="url(#arrow-seq)"/><text x="205" y="396" class="d-label">next message</text>
<line x1="300" y1="402" x2="668" y2="402" class="d-line" marker-end="url(#arrow-seq)"/><text x="500" y="396" class="d-label d-start">resume Actor</text>
</svg>
<figcaption>The numbers match the steps above. After step 1, the client talks only to the controller.</figcaption>
</figure>

So configuration lives in Kubernetes, conversations live in PostgreSQL, and
running agents live in Substrate. `kubectl get agents` lists Agents, but no
`kubectl` command lists Sessions or chat history; those come from the
controller's APIs.

### Ways In

| Surface | Used for |
| --- | --- |
| Kubernetes API | Writing Agents, Harnesses, AgentTemplates, models, and MCP servers. |
| gRPC and gRPC-Web | Listing agents and managing Sessions. The Agents page you will change reads from here. |
| A2A | Sending messages to an agent and streaming its progress. |
| MCP | Letting other agents and tools find and call kagent agents. |

## How an Agent Becomes Ready

Applying an Agent does not start a process that waits for chats. First the
controller has to prepare a revision, which commonly takes a minute or more.
The Status filter you will build groups Agents by where they are in that
process. This chapter explains each state and where it comes from.

### Preparing a Revision

A **revision** is an immutable, compiled copy of everything needed to run the
Agent. The controller prepares one in five steps:

1. **Resolve.** Read the Agent's template and Harness, plus everything they
   reference: models, MCP servers, subagent templates.
2. **Compile.** The Harness's runtime turns those inputs into the revision:
   image, configuration, capacity, and snapshot settings.
3. **Apply.** Register the revision with Substrate.
4. **Snapshot.** Substrate boots one instance of the runtime and saves the
   golden snapshot once it is ready. This is the slow step.
5. **Succeed.** Record the new revision as the Agent's
   `latestSuccessfulRevision`.

<figure class="diagram" role="img" aria-label="Five steps in a row: Resolve, Compile, Apply, Snapshot, and Succeed. Every edit starts again at Resolve. A highlight moves through the steps and stays longest on Snapshot.">
<svg viewBox="0 0 770 160" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow-pipe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-arrowhead"/></marker></defs>
<rect x="10" y="20" width="124" height="70" rx="6" class="d-box"/>
<rect x="167" y="20" width="124" height="70" rx="6" class="d-box"/>
<rect x="324" y="20" width="124" height="70" rx="6" class="d-box"/>
<rect x="481" y="20" width="124" height="70" rx="6" class="d-box"/>
<rect x="638" y="20" width="124" height="70" rx="6" class="d-box"/>
<rect x="0" y="20" width="124" height="70" rx="6" class="d-cursor d-cursor-pipe"/>
<line x1="134" y1="55" x2="165" y2="55" class="d-line" marker-end="url(#arrow-pipe)"/>
<line x1="291" y1="55" x2="322" y2="55" class="d-line" marker-end="url(#arrow-pipe)"/>
<line x1="448" y1="55" x2="479" y2="55" class="d-line" marker-end="url(#arrow-pipe)"/>
<line x1="605" y1="55" x2="636" y2="55" class="d-line" marker-end="url(#arrow-pipe)"/>
<text x="72" y="50" class="d-title">1 Resolve</text><text x="72" y="70" class="d-note">read references</text>
<text x="229" y="50" class="d-title">2 Compile</text><text x="229" y="70" class="d-note">build revision</text>
<text x="386" y="50" class="d-title">3 Apply</text><text x="386" y="70" class="d-note">send to Substrate</text>
<text x="543" y="50" class="d-title">4 Snapshot</text><text x="543" y="70" class="d-note">boot once, save</text>
<text x="700" y="50" class="d-title">5 Succeed</text><text x="700" y="70" class="d-note">update status</text>
<path d="M700 90V125H72V92" class="d-line d-fill-none" marker-end="url(#arrow-pipe)"/>
<text x="386" y="145" class="d-label">every edit starts again for a new revision</text>
</svg>
<figcaption>Step 4 is the slow one. While it runs, the Agent reports <code>Ready=False</code> with reason <code>ActorTemplatePending</code>.</figcaption>
</figure>

Every change to the Agent, its template, its Harness, or anything they
reference starts this again for a new revision.

### Edits Never Break Running Conversations

Each Session stays pinned to the revision it started on, and new Sessions
always start from the latest *successful* revision. So:

- While a new revision is being prepared, or after it fails, chats keep
  working on the previous successful revision.
- New Sessions pick up a change only after its revision succeeds.
- An Agent with no successful revision yet cannot start a Session.

<figure class="diagram" role="img" aria-label="Three revisions of one Agent. Revisions 1 and 2 succeeded; revision 3 failed. Session A is pinned to revision 1 and Session B to revision 2. A new session starts on revision 2, the latest successful revision.">
<svg viewBox="0 0 760 245" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow-pin" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-arrowhead"/></marker></defs>
<text x="380" y="34" class="d-label">latestSuccessfulRevision</text>
<text x="640" y="34" class="d-label">desiredRevision</text>
<rect x="40" y="45" width="160" height="64" rx="6" class="d-box"/>
<text x="120" y="72" class="d-title">Revision 1</text><text x="120" y="92" class="d-note">succeeded</text>
<rect x="300" y="45" width="160" height="64" rx="6" class="d-box d-focus"/>
<text x="380" y="72" class="d-title">Revision 2</text><text x="380" y="92" class="d-note">succeeded</text>
<rect x="560" y="45" width="160" height="64" rx="6" class="d-box d-error"/>
<text x="640" y="72" class="d-title">Revision 3</text><text x="640" y="92" class="d-note d-error-text">failed: bad reference</text>
<line x1="200" y1="77" x2="298" y2="77" class="d-line" marker-end="url(#arrow-pin)"/><text x="249" y="69" class="d-label">edit</text>
<line x1="460" y1="77" x2="558" y2="77" class="d-line" marker-end="url(#arrow-pin)"/><text x="509" y="69" class="d-label">edit</text>
<rect x="40" y="175" width="160" height="56" rx="6" class="d-box"/>
<text x="120" y="199" class="d-title">Session A</text><text x="120" y="218" class="d-note">started on rev 1</text>
<rect x="300" y="175" width="160" height="56" rx="6" class="d-box"/>
<text x="380" y="199" class="d-title">Session B</text><text x="380" y="218" class="d-note">started on rev 2</text>
<rect x="560" y="175" width="160" height="56" rx="6" class="d-box d-idle d-focus"/>
<text x="640" y="199" class="d-title">New session</text><text x="640" y="218" class="d-note">starts on rev 2</text>
<line x1="120" y1="175" x2="120" y2="111" class="d-line" marker-end="url(#arrow-pin)"/><text x="130" y="148" class="d-label d-start">pinned</text>
<line x1="380" y1="175" x2="380" y2="111" class="d-line" marker-end="url(#arrow-pin)"/><text x="390" y="148" class="d-label d-start">pinned</text>
<line x1="600" y1="175" x2="424" y2="111" class="d-line d-flow" marker-end="url(#arrow-pin)"/>
</svg>
<figcaption>Revision 3 failed, so the Agent shows Update failed. Existing sessions keep their revisions, and new ones start on revision 2.</figcaption>
</figure>

As a result, an Agent can be usable and out of date at the same time, which is
why the filter has six states and not just "ready" and "not ready". An Agent in
Update failed still accepts new chats, but it is not running the configuration
you last applied.

### What the Agent Reports

The controller writes its progress to the Agent's `status`:

| Field | Meaning |
| --- | --- |
| `observedGeneration` | The last spec generation the controller has processed. If it is lower than `metadata.generation`, the controller has not yet seen the latest edit. |
| `desiredRevision` | The revision compiled from the current configuration. |
| `latestSuccessfulRevision` | The newest revision that finished all five steps. New Sessions start here. |
| `conditions` | `Accepted`, `ResolvedRefs`, `Compatible`, and `Ready`, plus `EgressPoliciesApplied`. |

A condition set to `False` usually means something went wrong. A missing
template or Harness sets `ResolvedRefs=False`. A template the chosen runtime
cannot run sets `Compatible=False`. There are two exceptions:

- `Ready=False` with reason `ActorTemplatePending` means the golden snapshot
  is still being taken. That is progress, not failure.
- `EgressPoliciesApplied=False` means a requested network grant was rejected.
  It is reported separately and never fails the revision.

### One Agent, Start to Finish

Here is how one Agent's state changes as you work with it:

<figure class="diagram" role="img" aria-label="State graph. Preparing becomes Ready when the snapshot is saved, or Failed if preparation fails. Ready becomes Updating after an edit. Updating returns to Ready if the new revision succeeds, or becomes Update failed if it fails. Update failed returns to Ready once a fix succeeds. A highlight follows the path in the table below.">
<svg viewBox="0 0 760 250" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow-state" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="d-arrowhead"/></marker></defs>
<rect x="30" y="30" width="160" height="56" rx="6" class="d-box"/>
<rect x="300" y="30" width="160" height="56" rx="6" class="d-box"/>
<rect x="570" y="30" width="160" height="56" rx="6" class="d-box"/>
<rect x="30" y="170" width="160" height="56" rx="6" class="d-box d-error"/>
<rect x="570" y="170" width="160" height="56" rx="6" class="d-box d-error"/>
<rect x="0" y="0" width="160" height="56" rx="6" class="d-cursor d-cursor-state"/>
<text x="110" y="54" class="d-title">Preparing</text><text x="110" y="73" class="d-note">cannot chat yet</text>
<text x="380" y="54" class="d-title">Ready</text><text x="380" y="73" class="d-note">chats use latest</text>
<text x="650" y="54" class="d-title">Updating</text><text x="650" y="73" class="d-note">chats use previous</text>
<text x="110" y="194" class="d-title">Failed</text><text x="110" y="213" class="d-note">cannot chat</text>
<text x="650" y="194" class="d-title">Update failed</text><text x="650" y="213" class="d-note">chats use previous</text>
<line x1="190" y1="58" x2="298" y2="58" class="d-line" marker-end="url(#arrow-state)"/><text x="244" y="50" class="d-label">snapshot saved</text>
<line x1="460" y1="48" x2="568" y2="48" class="d-line" marker-end="url(#arrow-state)"/><text x="514" y="40" class="d-label">you edit</text>
<line x1="568" y1="70" x2="462" y2="70" class="d-line" marker-end="url(#arrow-state)"/><text x="514" y="88" class="d-label">succeeds</text>
<line x1="110" y1="86" x2="110" y2="168" class="d-line" marker-end="url(#arrow-state)"/><text x="120" y="131" class="d-label d-start">fails</text>
<line x1="650" y1="86" x2="650" y2="168" class="d-line" marker-end="url(#arrow-state)"/><text x="660" y="131" class="d-label d-start">fails</text>
<path d="M568 198H380V88" class="d-line d-fill-none" marker-end="url(#arrow-state)"/><text x="474" y="190" class="d-label">fix succeeds</text>
</svg>
<figcaption>The highlight follows the table below. No status, not shown, means the controller has reported nothing yet.</figcaption>
</figure>

| What happens | What the status shows | State |
| --- | --- | --- |
| You apply a new Agent. | No successful revision yet; snapshot pending. | Preparing |
| The snapshot finishes. | `latestSuccessfulRevision` equals `desiredRevision`; no failing conditions. | Ready |
| You edit the system prompt. | A new `desiredRevision` differs from `latestSuccessfulRevision`. | Updating |
| Your next edit names an MCP server that does not exist. | `ResolvedRefs=False`, but a successful revision still exists. | Update failed |
| You fix the name and the revision succeeds. | Both revisions match again; no failing conditions. | Ready |
| A different new Agent names a Harness that does not exist. | `ResolvedRefs=False` and no successful revision. | Failed |

### The Exact Rule

The UI computes the state in `agentRevisionState`
(`ui/src/api/domain/agents.ts`). Later in this lab you will move this
calculation into the controller, so it helps to know it exactly. It uses two
checks:

- **Failing:** any condition is `False`, ignoring the two exceptions above.
- **Behind:** `observedGeneration` is lower than `metadata.generation`, or
  `desiredRevision` is set and differs from `latestSuccessfulRevision`.

| Has a successful revision? | Failing? | Behind? | State |
| --- | --- | --- | --- |
| Yes | Yes | Either | Update failed |
| Yes | No | Yes | Updating |
| Yes | No | No | Ready |
| No | Yes | Either | Failed |
| No | No | Yes, or `desiredRevision` is set | Preparing |
| No | No | No, and no `desiredRevision` | No status |

### Where This Lab Touches the Code

| Path | What lives there | In this lab |
| --- | --- | --- |
| `ui/` | The web UI | Add the filter function, its tests, and the Status control. |
| `go/core/internal/service` | Controller services and workflows | Add the Go revision-state calculation. |
| `go/core/internal/grpcserver` | gRPC handlers | Fill the new field when mapping an Agent. |
| `proto/` | gRPC API definitions | Add the `revision_state` response field. |
| `go/api/v1alpha3` | Kubernetes API types | Read only; no CRD change. |

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
