const fs = require("fs");
const dayjs = require("dayjs");
const chalk = require("chalk");

// Check command line arguments
const showAll = process.argv.includes("--all");
const prefix = showAll ? "all_" : "";

// Read the data files
const orders = JSON.parse(
  fs.readFileSync(`./data/wolt/${prefix}wolt_orders.json`, "utf8")
);
const items = JSON.parse(
  fs.readFileSync(`./data/wolt/${prefix}wolt_items.json`, "utf8")
);

// Helper function to format currency
const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "KZT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to print a section header
const printSection = (title) => {
  console.log("\n" + chalk.bold.blue("=== " + title + " ==="));
};

// Print data range info
const dateRange = orders.map((order) => order.delivery_time).sort();

const startDate = dayjs(dateRange[0]).format("MMMM D, YYYY");
const endDate = dayjs(dateRange[dateRange.length - 1]).format("MMMM D, YYYY");

console.log(chalk.bold.green("📊 Wolt Order Statistics"));
console.log(chalk.bold.green(`📅 Date Range: ${startDate} - ${endDate}`));

// Basic Order Statistics
printSection("Basic Order Statistics");

const totalOrders = orders.length;
const totalItems = items.length;
const totalSpent = orders.reduce((sum, order) => sum + order.total_price, 0);
const currency = orders[0]?.currency || "KZT";

console.log(chalk.green(`📦 Total Orders: ${totalOrders}`));
console.log(chalk.green(`🍽️ Total Items: ${totalItems}`));
console.log(
  chalk.green(`💰 Total Spent: ${formatCurrency(totalSpent, currency)}`)
);
console.log(
  chalk.green(
    `📊 Average Items per Order: ${(totalItems / totalOrders).toFixed(1)}`
  )
);
console.log(
  chalk.green(
    `💵 Average Order Value: ${formatCurrency(
      totalSpent / totalOrders,
      currency
    )}`
  )
);

// Calculate orders per month
const monthsBetween =
  dayjs(dateRange[dateRange.length - 1]).diff(dayjs(dateRange[0]), "month") + 1;
console.log(
  chalk.green(
    `📈 Average Orders per Month: ${(totalOrders / monthsBetween).toFixed(1)}`
  )
);

// Time-based Analysis
printSection("Time-based Analysis");

const ordersByMonth = orders.reduce((acc, order) => {
  const month = order["year-month"];
  acc[month] = (acc[month] || 0) + 1;
  return acc;
}, {});

const mostOrderedMonth = Object.entries(ordersByMonth).sort(
  (a, b) => b[1] - a[1]
)[0];

console.log(
  chalk.yellow(
    `📅 Most Active Month: ${mostOrderedMonth[0]} (${mostOrderedMonth[1]} orders)`
  )
);

// Add day of week analysis
const ordersByDay = orders.reduce((acc, order) => {
  const day = dayjs(order.delivery_time).format("dddd");
  acc[day] = (acc[day] || 0) + 1;
  return acc;
}, {});

const mostOrderedDay = Object.entries(ordersByDay).sort(
  (a, b) => b[1] - a[1]
)[0];

console.log(
  chalk.yellow(
    `📆 Most Active Day: ${mostOrderedDay[0]} (${mostOrderedDay[1]} orders)`
  )
);

// Venue Analysis
printSection("Venue Analysis");

const venueStats = orders.reduce((acc, order) => {
  const venue = order.venue_name_fixed;
  acc[venue] = acc[venue] || { count: 0, total: 0 };
  acc[venue].count++;
  acc[venue].total += order.total_price;
  return acc;
}, {});

const favoriteVenues = Object.entries(venueStats)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5);

console.log(chalk.magenta("🏪 Top 5 Most Ordered Places:"));
favoriteVenues.forEach(([venue, stats], index) => {
  console.log(
    chalk.magenta(
      `   ${index + 1}. ${venue} (${stats.count} orders, ${formatCurrency(
        stats.total,
        currency
      )})`
    )
  );
});

// Item Analysis
printSection("Item Analysis");

const itemStats = items.reduce((acc, item) => {
  const name = item.name;
  acc[name] = acc[name] || { count: 0, total: 0 };
  acc[name].count += item.count;
  acc[name].total += item.price * item.count;
  return acc;
}, {});

const favoriteItems = Object.entries(itemStats)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5);

console.log(chalk.cyan("🍔 Top 5 Most Ordered Items:"));
favoriteItems.forEach(([item, stats], index) => {
  console.log(
    chalk.cyan(
      `   ${index + 1}. ${item} (ordered ${stats.count} times, ${formatCurrency(
        stats.total,
        currency
      )})`
    )
  );
});

// Spending Patterns
printSection("Spending Patterns");

// Monthly spending analysis
const monthlySpending = orders.reduce((acc, order) => {
  const month = order["year-month"];
  acc[month] = acc[month] || { total: 0, count: 0, items: 0 };
  acc[month].total += order.total_price;
  acc[month].count++;
  acc[month].items += items
    .filter((item) => item.order_id === order.order_id)
    .reduce((sum, item) => sum + item.count, 0);
  return acc;
}, {});

const monthlyStats = Object.entries(monthlySpending).map(([month, stats]) => ({
  month,
  total: stats.total,
  count: stats.count,
  items: stats.items,
  avgPerOrder: stats.total / stats.count,
  avgItemsPerOrder: stats.items / stats.count,
}));

// Sort by total spending
const topSpendingMonth = monthlyStats.sort((a, b) => b.total - a.total)[0];
const lowestSpendingMonth = monthlyStats.sort((a, b) => a.total - b.total)[0];

// Calculate averages
const avgMonthlySpending =
  monthlyStats.reduce((sum, month) => sum + month.total, 0) /
  monthlyStats.length;
const avgMonthlyOrders =
  monthlyStats.reduce((sum, month) => sum + month.count, 0) /
  monthlyStats.length;
const avgMonthlyItems =
  monthlyStats.reduce((sum, month) => sum + month.items, 0) /
  monthlyStats.length;

console.log(chalk.red("💰 Monthly Spending Analysis:"));
console.log(chalk.red(`   Top Spending Month: ${topSpendingMonth.month}`));
console.log(
  chalk.red(`      Total: ${formatCurrency(topSpendingMonth.total, currency)}`)
);
console.log(chalk.red(`      Orders: ${topSpendingMonth.count}`));
console.log(chalk.red(`      Items: ${topSpendingMonth.items}`));
console.log(
  chalk.red(
    `      Average per Order: ${formatCurrency(
      topSpendingMonth.avgPerOrder,
      currency
    )}`
  )
);

console.log(
  chalk.red(`\n   Lowest Spending Month: ${lowestSpendingMonth.month}`)
);
console.log(
  chalk.red(
    `      Total: ${formatCurrency(lowestSpendingMonth.total, currency)}`
  )
);
console.log(chalk.red(`      Orders: ${lowestSpendingMonth.count}`));
console.log(chalk.red(`      Items: ${lowestSpendingMonth.items}`));
console.log(
  chalk.red(
    `      Average per Order: ${formatCurrency(
      lowestSpendingMonth.avgPerOrder,
      currency
    )}`
  )
);

console.log(chalk.red("\n   Monthly Averages:"));
console.log(
  chalk.red(`      Spending: ${formatCurrency(avgMonthlySpending, currency)}`)
);
console.log(chalk.red(`      Orders: ${avgMonthlyOrders.toFixed(1)}`));
console.log(chalk.red(`      Items: ${avgMonthlyItems.toFixed(1)}`));

// Original spending patterns section
const avgSpendingByMonth = monthlyStats.sort(
  (a, b) => b.avgPerOrder - a.avgPerOrder
);

console.log(chalk.red("\n💳 Order Value Patterns:"));
console.log(
  chalk.red(
    `   Highest Average Order: ${avgSpendingByMonth[0].month} (${formatCurrency(
      avgSpendingByMonth[0].avgPerOrder,
      currency
    )} per order)`
  )
);
console.log(
  chalk.red(
    `   Lowest Average Order: ${
      avgSpendingByMonth[avgSpendingByMonth.length - 1].month
    } (${formatCurrency(
      avgSpendingByMonth[avgSpendingByMonth.length - 1].avgPerOrder,
      currency
    )} per order)`
  )
);

// Fun Facts
printSection("Fun Facts");

const mostExpensiveOrder = orders.sort(
  (a, b) => b.total_price - a.total_price
)[0];
const cheapestOrder = orders
  .filter((order) => order.total_price > 0)
  .sort((a, b) => a.total_price - b.total_price)[0];
const mostItemsInOrder = orders
  .map((order) => ({
    ...order,
    itemCount: items
      .filter((item) => item.order_id === order.order_id)
      .reduce((sum, item) => sum + item.count, 0),
  }))
  .sort((a, b) => b.itemCount - a.itemCount)[0];

console.log(chalk.hex("#FFA500")("🏆 Most Expensive Order:"));
console.log(
  chalk.hex("#FFA500")(
    `   ${formatCurrency(mostExpensiveOrder.total_price, currency)} at ${
      mostExpensiveOrder.venue_name_fixed
    }`
  )
);
console.log(
  chalk.hex("#FFA500")(
    `   Date: ${dayjs(mostExpensiveOrder.delivery_time).format("MMMM D, YYYY")}`
  )
);

console.log(chalk.hex("#FFA500")("\n🎯 Most Items in One Order:"));
console.log(
  chalk.hex("#FFA500")(
    `   ${mostItemsInOrder.itemCount} items at ${mostItemsInOrder.venue_name_fixed}`
  )
);
console.log(
  chalk.hex("#FFA500")(
    `   Total: ${formatCurrency(mostItemsInOrder.total_price, currency)}`
  )
);

console.log(chalk.hex("#FFA500")("\n💝 Budget-Friendly Order:"));
console.log(
  chalk.hex("#FFA500")(
    `   ${formatCurrency(cheapestOrder.total_price, currency)} at ${
      cheapestOrder.venue_name_fixed
    }`
  )
);
