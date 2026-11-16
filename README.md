# ConceptTrainer

Local concept-expansion trainer. It fills a concept node from hand-authored templates and a lexicon, then prints prompt-response pairs for a local fine-tune set. No API. No network. Same concept and pair index always reprint the same text.

npm install
npm start

That opens [http://127.0.0.1:8787](http://127.0.0.1:8787). `PORT` changes the port. `NO_OPEN=1` skips the browser. `HOST` defaults to `127.0.0.1`.

Enter a concept, choose how many pairs (1–200), hit generate. Copy or download the text. Output is plain blocks, not markdown.

## Swap the generator

The page only posts to `POST /api/generate`. [`server.mjs`](server.mjs) loads JSON, then calls `generatePairs({ concept, count, families })` from [`src/generator.mjs`](src/generator.mjs). Replace that module and keep the same export. Leave the page alone.

## Add a family

Drop one JSON file in [`data/families/`](data/families/). Restart. No code change.

The loader reads every `*.json` in that directory. The built-in file is `consequence-weighing.json`: six slots (definition, mechanism, failure mode, analogy, edge case, application) and a lexicon of consequence-weighing atoms (input action, immediate outcome, downstream ripple, worst case, mitigation, plus actor, stake, horizon, definition fragment). At least twenty prompt templates and twenty response templates per slot.

```json
{
  "id": "consequence-weighing",
  "label": "Consequence weighing",
  "default": true,
  "keywords": ["consequence weighing"],
  "lexicon": { "actor": ["the person who owns the decision"] },
  "slots": [
    {
      "id": "definition",
      "label": "Definition",
      "prompts": ["What does consequence weighing mean for {concept}?"],
      "templates": ["Consequence weighing on {concept} is the rule that {actor} names the downside."]
    }
  ]
}
```

`{concept}` is the text you typed. Other `{placeholders}` come from that file's lexicon. One binding is sampled per pair and reused across every slot, so the block stays on one scenario. Slot order rotates, so the set does not open the same way every time.

If the concept text contains a family's keyword, that family is used. Otherwise the file marked `"default": true` is used, and your concept is still the subject.

## Test

```
npm test
```
