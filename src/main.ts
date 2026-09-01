import {
    createInterface
} from "readline";
import {
    parseGrammar
} from "./engine/grammarParser";
import {
    computeFirstSets,
    computeFollowSets,
} from "./engine/firstFollow";
import {
    buildCanonicalCollection,
} from "./engine/lr1Items";
import {
    mergeLR1States
} from "./engine/lalrMerge";
import {
    buildParsingTable
} from "./engine/parseTable";
import type {
    Grammar,
    LR1Item,
    LR1State,
    LALRState,
    Action,
} from "./engine/types";

const EPSILON = "Îµ";

function printLine() {
    console.log("=".repeat(70));
}

function printSection(title: string) {
    console.log("\n");
    printLine();
    console.log(`  ${title}`);
    printLine();
}

function formatSet(set: Set < string > ): string {
    return `{ ${[...set].join(", ")} }`;
}

function formatItem(
    item: LR1Item,
    grammar: Grammar
): string {
    const production = grammar.productions[item.productionId];

    let rhs = [...production.rhs];

    // Display epsilon nicely
    if (rhs.length === 1 && rhs[0] === EPSILON) {
        rhs = [EPSILON];
    }

    const result: string[] = [];

    for (let i = 0; i <= rhs.length; i++) {
        if (i === item.dot) {
            result.push("•");
        }

        if (i < rhs.length) {
            result.push(rhs[i]);
        }
    }

    return `${production.lhs} → ${result.join(" ")} , ${formatSet(
    item.lookahead
  )}`;
}

function printGrammar(grammar: Grammar) {
    printSection("1. GRAMMAR");

    console.log(`Start Symbol    : ${grammar.startSymbol}`);
    console.log(`Augmented Start : ${grammar.augmentedStart}`);

    console.log("\nProductions:");

    for (const production of grammar.productions) {
        console.log(
            `  (${production.id}) ${production.lhs} → ${production.rhs.join(" ")}`
        );
    }

    console.log("\nTerminals:");
    console.log(`  ${formatSet(grammar.terminals)}`);

    console.log("\nNon-Terminals:");
    console.log(`  ${formatSet(grammar.nonTerminals)}`);
}

function printFirstFollow(
    grammar: Grammar,
    firstSets: Map < string, Set < string >> ,
    followSets: Map < string, Set < string >>
) {
    printSection("2. FIRST / FOLLOW SETS");

    console.log("\nFIRST:");

    for (const nt of grammar.nonTerminals) {
        console.log(
            `  FIRST(${nt}) = ${formatSet(firstSets.get(nt) ?? new Set())}`
        );
    }

    console.log("\nFOLLOW:");

    for (const nt of grammar.nonTerminals) {
        console.log(
            `  FOLLOW(${nt}) = ${formatSet(
        followSets.get(nt) ?? new Set()
      )}`
        );
    }
}

function printLR1States(
    grammar: Grammar,
    states: LR1State[]
) {
    printSection(
        `3. CANONICAL LR(1) COLLECTION — ${states.length} STATES`
    );

    for (const state of states) {
        console.log(`\nI${state.id}:`);

        for (const item of state.items) {
            console.log(`  ${formatItem(item, grammar)}`);
        }

        if (state.transitions.size > 0) {
            console.log("\n  Transitions:");

            for (const [symbol, target] of state.transitions) {
                console.log(`    ${symbol} → I${target}`);
            }
        }
    }
}

function printLR0Cores(
    grammar: Grammar,
    states: LR1State[]
) {
    printSection("4. LR(0) CORE IDENTIFICATION");

    for (const state of states) {
        console.log(`\nCore of I${state.id}:`);

        const seen = new Set < string > ();

        for (const item of state.items) {
            const key = `${item.productionId}:${item.dot}`;

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);

            const production = grammar.productions[item.productionId];

            let rhs = [...production.rhs];
            const result: string[] = [];

            for (let i = 0; i <= rhs.length; i++) {
                if (i === item.dot) {
                    result.push("•");
                }

                if (i < rhs.length) {
                    result.push(rhs[i]);
                }
            }

            console.log(
                `  ${production.lhs} → ${result.join(" ")}`
            );
        }

        console.log(`  Fingerprint: ${state.coreFingerprint}`);
    }
}

function printLALRMerge(
    states: LALRState[]
) {
    printSection("5. LALR STATE MERGING");

    console.log(`Canonical LR(1) states : ${states.reduce(
    (max, state) =>
      Math.max(max, ...state.mergedFrom),
    -1
  ) + 1}`);

    console.log(`LALR states             : ${states.length}`);

    console.log("\nState groups:");

    for (const state of states) {
        if (state.mergedFrom.length > 1) {
            console.log(
                `  LALR State ${state.id} ← { ${state.mergedFrom
          .map(id => `I${id}`)
          .join(", ")} }`
            );
        } else {
            console.log(
                `  LALR State ${state.id} ← { I${state.mergedFrom[0]} }`
            );
        }
    }

    const mergedGroups = states.filter(
        state => state.mergedFrom.length > 1
    );

    if (mergedGroups.length === 0) {
        console.log("\nNo states required merging for this grammar.");
    } else {
        console.log(
            `\nTotal merged groups: ${mergedGroups.length}`
        );
    }
}

function actionToString(action: Action): string {
    switch (action.type) {
        case "shift":
            return `s${action.target}`;

        case "reduce":
            return `r${action.target}`;

        case "accept":
            return "acc";

        case "error":
            return "err";

        default:
            return "?";
    }
}

function printParsingTable(
    grammar: Grammar,
    states: LALRState[],
    parsingTable: ReturnType < typeof buildParsingTable >
) {
    printSection("6. ACTION / GOTO PARSING TABLE");

    const terminals = [...grammar.terminals];

    if (!terminals.includes("$")) {
        terminals.push("$");
    }

    const nonTerminals = [...grammar.nonTerminals].filter(
        nt => nt !== grammar.augmentedStart
    );

    console.log(
        "\nACTION columns: " +
        terminals.join(" | ")
    );

    console.log(
        "GOTO columns  : " +
        nonTerminals.join(" | ")
    );

    console.log("\nTable:");

    for (const state of states) {
        const actionParts: string[] = [];

        for (const terminal of terminals) {
            const stateActionTable =
                parsingTable.actionTable.get(state.id);

            const actions = stateActionTable ?
                stateActionTable.get(terminal) :
                undefined;

            if (actions && actions.length > 0) {
                actionParts.push(
                    `${terminal}: ${actions
        .map(actionToString)
        .join("/")}`
                );
            }
        }
        const gotoParts: string[] = [];

        for (const nt of nonTerminals) {
            const stateGotoTable =
                parsingTable.gotoTable.get(state.id);

            const target = stateGotoTable ?
                stateGotoTable.get(nt) :
                undefined;

            if (target !== undefined) {
                gotoParts.push(`${nt}: ${target}`);
            }
        }

        console.log(`\nState ${state.id}`);

        console.log(
            `  ACTION: ${
        actionParts.length > 0
          ? actionParts.join(" | ")
          : "-"
      }`
        );

        console.log(
            `  GOTO  : ${
        gotoParts.length > 0
          ? gotoParts.join(" | ")
          : "-"
      }`
        );
    }

    console.log(
        `\nConflicts detected: ${parsingTable.conflicts.length}`
    );

    if (parsingTable.conflicts.length > 0) {
        for (const conflict of parsingTable.conflicts) {
            console.log(
                `  ${conflict.type} conflict in State ${conflict.stateId} on '${conflict.symbol}': ` +
                conflict.actions.map(actionToString).join(" / ")
            );
        }
    }
}

function runParser(grammarInput: string) {
    try {
        const grammar = parseGrammar(grammarInput);

        printGrammar(grammar);

        const firstSets = computeFirstSets(grammar);

        const followSets = computeFollowSets(
            grammar,
            firstSets
        );

        printFirstFollow(
            grammar,
            firstSets,
            followSets
        );

        const lr1States =
            buildCanonicalCollection(
                grammar,
                firstSets
            );

        printLR1States(
            grammar,
            lr1States
        );

        printLR0Cores(
            grammar,
            lr1States
        );

        const lalrStates =
            mergeLR1States(lr1States);

        printLALRMerge(lalrStates);

        const parsingTable =
            buildParsingTable(
                grammar,
                lalrStates
            );

        printParsingTable(
            grammar,
            lalrStates,
            parsingTable
        );

    
    } catch (error) {
        printSection("GRAMMAR ERROR");

        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log(error);
        }
    }
}

const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log("\n");
printLine();
console.log("       LALR PARSER GENERATOR");
console.log("              REVIEW 1");
printLine();

console.log("\nEnter your grammar.");
console.log("Use one production per line.");
console.log("Use -> for the production arrow.");
console.log("Use | for alternatives.");
console.log("Press ENTER on an empty line when finished.\n");

const grammarLines: string[] = [];

const askForGrammar = () => {
    readline.question("> ", line => {
        if (line.trim() === "") {
            readline.close();

            if (grammarLines.length === 0) {
                console.log("\nNo grammar entered.");
                return;
            }

            const grammarInput =
                grammarLines.join("\n");

            runParser(grammarInput);
            return;
        }

        grammarLines.push(line);
        askForGrammar();
    });
};

askForGrammar();