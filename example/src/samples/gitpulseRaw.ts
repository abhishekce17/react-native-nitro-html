// Raw JSON-decoded string (as returned by fetch().then(r => r.json()) in real apps)
export const GITPULSE_HTML = `<p>In May I shipped <strong>gitpulse</strong> — a tiny CLI that shows your git repo's analytics right in the terminal: commit stats, contributor graphs, file breakdowns, recent activity.</p>
<p>One\n\n]n command. Zero config. No dashboard. No login.<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight shell"><code>npx @wuchunjie/gitpulse
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>\n\n

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>Three months later, I ran it on my own Windows machine and got:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight plaintext"><code>  ❌  Not a git repository.
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>...inside a perfectly valid git repository. And the worst part: <strong>it had been failing on every Windows machine since day one.</strong> It just never told me.</p>

<h2>
  <a name="the-bug" href="#the-bug">
  </a>
  The Bug
</h2>

<p>Here's the line that checked whether we're inside a git repo:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight javascript"><code><span class="kd">function</span> <span class="nf">run</span><span class="p">(</span><span class="nx">cmd</span><span class="p">)</span> <span class="p">{</span>
  <span class="k">try</span> <span class="p">{</span>
    <span class="k">return</span> <span class="nf">execSync</span><span class="p">(</span><span class="nx">cmd</span><span class="p">,</span> <span class="p">{</span> <span class="na">encoding</span><span class="p">:</span> <span class="dl">"</span><span class="s2">utf-8</span><span class="dl">"</span><span class="p">,</span> <span class="na">stdio</span><span class="p">:</span> <span class="p">[</span><span class="dl">"</span><span class="s2">pipe</span><span class="dl">"</span><span class="p">,</span> <span class="dl">"</span><span class="s2">pipe</span><span class="dl">"</span><span class="p">,</span> <span class="dl">"</span><span class="s2">pipe</span><span class="dl">"</span><span class="p">]</span> <span class="p">}).</span><span class="nf">trim</span><span class="p">();</span>
  <span class="p">}</span> <span class="k">catch</span> <span class="p">{</span>
    <span class="k">return</span> <span class="dl">"</span><span class="dl">"</span><span class="p">;</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="kd">const</span> <span class="nx">isRepo</span> <span class="o">=</span> <span class="nf">run</span><span class="p">(</span><span class="s2">\`cd "\\\${dir}\\" &amp;&amp; git rev-parse --git-dir 2&gt;/dev/null\`</span><span class="p">);</span>
<span class="k">if </span><span class="p">(</span><span class="o">!</span><span class="nx">isRepo</span><span class="p">)</span> <span class="p">{</span>
  <span class="nx">console</span><span class="p">.</span><span class="nf">log</span><span class="p">(</span><span class="dl">"</span><span class="s2">  ❌  Not a git repository.</span><span class="dl">"</span><span class="p">);</span>
  <span class="nx">process</span><span class="p">.</span><span class="nf">exit</span><span class="p">(</span><span class="mi">1</span><span class="p">);</span>
<span class="p">}</span>
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>This is completely normal, boring code. <code>git rev-parse --git-dir</code> prints <code>.git</code> in a repo, nothing on stdout otherwise, and <code>2&gt;/dev/null</code> keeps the error message quiet. Works on Linux. Works on macOS. Works in my CI.</p>

<p>Then why did it die on Windows?</p>

<h2>
  <a name="-raw-2gtdevnull-endraw-does-not-exist-on-windows" href="#-raw-2gtdevnull-endraw-does-not-exist-on-windows">
  </a>
  <code>2&gt;/dev/null</code> Does Not Exist on Windows
</h2>

<p>On Linux and macOS, <code>2&gt;/dev/null</code> redirects stderr to the kernel's null device.</p>

<p>On Windows, Node's <code>execSync</code> doesn't run your command in bash — <strong>it runs it in <code>cmd.exe</code></strong>. And <code>cmd.exe</code> interprets <code>2&gt;/dev/null</code> literally: "open the file at path <code>/dev/null</code> for writing."</p>

<p>That path doesn't exist. <code>cmd.exe</code> gives up with:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight plaintext"><code>The system cannot find the path specified.
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>The command exits non-zero, my <code>catch</code> block swallows it, <code>isRepo</code> becomes an empty string, and gitpulse cheerfully announces "Not a git repository" in a repo that's very much a repo.</p>

<p>Silent failure. Wrong error message. Zero stack trace. For three months.</p>

<h2>
  <a name="the-debug-journey" href="#the-debug-journey">
  </a>
  The Debug Journey
</h2>

<p>Because I develop in git-bash, the first clue was confusing: <code>git rev-parse --git-dir</code> worked fine in my shell, so of course I ran the same command through Node to compare:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight shell"><code>node <span class="nt">-e</span> <span class="s2">"console.log(require('child_process').execSync('git rev-parse --git-dir', {encoding:'utf-8'}).trim())"</span>
<span class="c"># → .git  ✅</span>
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>Works in Node. Fails in gitpulse. So I bisected the exact command string, adding pieces back one by one:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight javascript"><code><span class="nf">execSync</span><span class="p">(</span><span class="dl">'</span><span class="s1">cd "." &amp;&amp; git rev-parse --git-dir</span><span class="dl">'</span><span class="p">)</span>          <span class="c1">// ✅ works</span>
<span class="nf">execSync</span><span class="p">(</span><span class="dl">'</span><span class="s1">cd "." &amp;&amp; git rev-parse --git-dir 2&gt;/dev/null</span><span class="dl">'</span><span class="p">)</span>  <span class="c1">// ❌ boom</span>
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>There it was. The redirect — the most innocent-looking six characters in the file — was the entire bug.</p>

<h2>
  <a name="the-fix" href="#the-fix">
  </a>
  The Fix
</h2>

<p>One line: <strong>delete the redirect.</strong><br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight javascript"><code><span class="kd">const</span> <span class="nx">isRepo</span> <span class="o">=</span> <span class="nf">run</span><span class="p">(</span><span class="s2">\`cd "\\\${dir}\\" &amp;&amp; git rev-parse --git-dir\`</span><span class="p">);</span>
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>Why is that safe? Because I'm already passing <code>stdio: ["pipe", "pipe", "pipe"]</code> — stderr is piped into Node's memory and never touches the terminal. There is nothing for <code>2&gt;/dev/null</code> to silence. The redirect wasn't protecting the user from noise; it was just a habit I'd copied from a shell script.</p>

<p>That's the whole fix. No platform detection. No <code>2&gt;nul</code> on Windows. Just: don't put POSIX shell syntax inside a string you hand to <code>child_process</code> on Windows.</p>

<h2>
  <a name="rules-im-writing-down-now" href="#rules-im-writing-down-now">
  </a>
  Rules I'm Writing Down Now
</h2>

<ol>
<li>
<strong><code>execSync</code> on Windows is <code>cmd.exe</code>, not bash.</strong> No <code>2&gt;/dev/null</code>, no <code>&amp;&amp;</code> chains with POSIX paths, no <code>$VAR</code> expansion.</li>
<li>
<strong>Prefer Node options over shell tricks.</strong> <code>stdio: "ignore"</code> or piped streams beat every shell redirect.</li>
<li>
<strong><code>git</code> commands print errors to stderr and exit codes — you usually don't need to suppress anything</strong> if you handle the exit code properly.</li>
<li>
<strong>Test on the OS your users are on.</strong> I write "cross-platform" in my README and then test on the one machine in my head. gitpulse users on Windows were getting a fake error for 90 days and I never noticed.</li>
</ol>

<h2>
  <a name="what-gitpulse-actually-shows" href="#what-gitpulse-actually-shows">
  </a>
  What gitpulse Actually Shows
</h2>

<p>The apology tour is over — here's the tool. Run it in any repo:<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight plaintext"><code>  📊  GITPULSE

  📝  Total commits: 2
  👤  Contributors:  1
  📅  Active days:   1
  📂  Files touched:  2

  👥  Top Contributors
    T                         ███████████████ 2

  📂  File Type Breakdown
    .txt        ███████████████ 2

  🔥  Recent Activity
    2026-08-30  ██████████████████████████████ 2
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<p>Point it at a big team repo and you get your bus-factor graph, the file-type mix (how much of your history is <code>.ts</code> vs <code>.md</code> vs mystery binary files), and a per-day activity strip — all rendered with plain Unicode blocks, no dependencies, no server, nothing leaving your machine.</p>

<p>It's the "wait, who actually maintains this repo?" answer, without opening a browser.<br>
</p>

<div class="highlight js-code-highlight">
<pre class="highlight shell"><code>npx @wuchunjie/gitpulse            <span class="c"># current repo</span>
npx @wuchunjie/gitpulse /path/to/repo
</code></pre>
<div class="highlight__panel js-actions-panel">
<div class="highlight__panel-action js-fullscreen-code-action">
    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-on"><title>Enter fullscreen mode</title>
    <path d="M16 3h6v6h-2V5h-4V3zM2 3h6v2H4v4H2V3zm18 16v-4h2v6h-6v-2h4zM4 19h4v2H2v-6h2v4z"></path>
</svg>

    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewbox="0 0 24 24" class="highlight-action crayons-icon highlight-action--fullscreen-off"><title>Exit fullscreen mode</title>
    <path d="M18 7h4v2h-6V3h2v4zM8 9H2V7h4V3h2v6zm10 8v4h-2v-6h6v2h-4zM8 15v6H6v-4H2v-2h6z"></path>
</svg>

</div>
</div>
</div>



<h2>
  <a name="if-youre-shipping-clis" href="#if-youre-shipping-clis">
  </a>
  If You're Shipping CLIs
</h2>

<p>Your users are on Windows. Not "some of your users." The ones who will install it, run it, get a confusing error, and quietly never come back.</p>

<p>Audit your <code>execSync</code> strings. If any of them contain <code>2&gt;/dev/null</code>, <code>&gt;/dev/null</code>, or a bash-ism of any flavor, they are lying to your Windows users right now.</p>

<p>And if you ever build a tool that looks at your git history the way you'd wish GitHub Insights did — but faster, offline, and in your terminal — gitpulse is live on npm. <code>npx @wuchunjie/gitpulse</code> and tell me what your repo looks like. I read every comment.</p>
`;
