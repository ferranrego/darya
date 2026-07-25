import { FSRS, generatorParameters, Rating, createEmptyCard } from "ts-fsrs";

const f = new FSRS(generatorParameters({
  enable_fuzz: true,
  enable_short_term: false,
  request_retention: 0.85,
  maximum_interval: 365
}));

const now = new Date();
const card = createEmptyCard(now);

const resGood = f.next(card, now, Rating.Good);
const resAgain = f.next(card, now, Rating.Again);

console.log("New Card:");
console.log("Good due:", resGood.card.due);
console.log("Again due:", resAgain.card.due);

const nextGood = f.next(resGood.card, resGood.card.due, Rating.Good);
console.log("\nReview Good Card again:");
console.log("Good due:", nextGood.card.due);

