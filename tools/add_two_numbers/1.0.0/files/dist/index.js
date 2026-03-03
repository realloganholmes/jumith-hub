const tool = {
  name: "add_two_numbers",
  description: "Add two numbers and return the sum.",
  async execute(input) {
    const a = Number(input?.a);
    const b = Number(input?.b);

    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error("Inputs a and b must be valid numbers.");
    }

    return { sum: a + b };
  }
};

module.exports = { tool };
