const fs = require("fs");
const dayjs = require("dayjs");
const chalk = require("chalk");
const {
  BASE_CURRENCY,
  convertToBaseCurrency,
  formatCurrency,
} = require("../utils/currency");

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

// Helper function to print a section header
const printSection = (title) => {
  console.log("\n" + chalk.bold.blue("=== " + title + " ==="));
};

async function generateStats() {
  // Convert all amounts to base currency
  console.log(`Converting all amounts to ${BASE_CURRENCY}...`);

  const processedOrders = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      total_price_base: await convertToBaseCurrency(
        order.total_price,
        order.currency,
        order.delivery_time
      ),
    }))
  );

  const processedItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      price_base: await convertToBaseCurrency(
        item.price,
        item.currency,
        processedOrders.find((o) => o.order_id === item.order_id)?.delivery_time
      ),
    }))
  );

  // Print data range info
  const dateRange = processedOrders.map((order) => order.delivery_time).sort();
  const startDate = dayjs(dateRange[0]).format("MMMM D, YYYY");
  const endDate = dayjs(dateRange[dateRange.length - 1]).format("MMMM D, YYYY");

  console.log(chalk.bold.green("📊 Wolt Order Statistics"));
  console.log(chalk.bold.green(`📅 Date Range: ${startDate} - ${endDate}`));

  // Basic Order Statistics
  printSection("Basic Order Statistics");

  const totalOrders = processedOrders.length;
  const totalItems = processedItems.length;
  const totalSpent = processedOrders.reduce(
    (sum, order) => sum + order.total_price_base,
    0
  );

  console.log(chalk.green(`📦 Total Orders: ${totalOrders}`));
  console.log(chalk.green(`🍽️ Total Items: ${totalItems}`));
  console.log(chalk.green(`💰 Total Spent: ${formatCurrency(totalSpent)}`));
  console.log(
    chalk.green(
      `📊 Average Items per Order: ${(totalItems / totalOrders).toFixed(1)}`
    )
  );
  console.log(
    chalk.green(
      `💵 Average Order Value: ${formatCurrency(totalSpent / totalOrders)}`
    )
  );

  // Calculate orders per month
  const monthsBetween =
    dayjs(dateRange[dateRange.length - 1]).diff(dayjs(dateRange[0]), "month") +
    1;
  console.log(
    chalk.green(
      `📈 Average Orders per Month: ${(totalOrders / monthsBetween).toFixed(1)}`
    )
  );

  // Time-based Analysis
  printSection("Time-based Analysis");

  const ordersByMonth = processedOrders.reduce((acc, order) => {
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
  const ordersByDay = processedOrders.reduce((acc, order) => {
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

  const venueStats = processedOrders.reduce((acc, order) => {
    const venue = order.venue_name_fixed;
    acc[venue] = acc[venue] || { count: 0, total: 0 };
    acc[venue].count++;
    acc[venue].total += order.total_price_base;
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
          stats.total
        )})`
      )
    );
  });

  // Item Analysis
  printSection("Item Analysis");

  const itemStats = processedItems.reduce((acc, item) => {
    const name = item.name;
    acc[name] = acc[name] || { count: 0, total: 0 };
    acc[name].count += item.count;
    acc[name].total += item.price_base * item.count;
    return acc;
  }, {});

  const favoriteItems = Object.entries(itemStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  console.log(chalk.cyan("🍔 Top 5 Most Ordered Items:"));
  favoriteItems.forEach(([item, stats], index) => {
    console.log(
      chalk.cyan(
        `   ${index + 1}. ${item} (ordered ${
          stats.count
        } times, ${formatCurrency(stats.total)})`
      )
    );
  });

  // Spending Patterns
  printSection("Spending Patterns");

  // Monthly spending analysis
  const monthlySpending = processedOrders.reduce((acc, order) => {
    const month = order["year-month"];
    acc[month] = acc[month] || { total: 0, count: 0, items: 0 };
    acc[month].total += order.total_price_base;
    acc[month].count++;
    acc[month].items += processedItems
      .filter((item) => item.order_id === order.order_id)
      .reduce((sum, item) => sum + item.count, 0);
    return acc;
  }, {});

  const monthlyStats = Object.entries(monthlySpending).map(
    ([month, stats]) => ({
      month,
      total: stats.total,
      count: stats.count,
      items: stats.items,
      avgPerOrder: stats.total / stats.count,
      avgItemsPerOrder: stats.items / stats.count,
    })
  );

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
    chalk.red(`      Total: ${formatCurrency(topSpendingMonth.total)}`)
  );
  console.log(chalk.red(`      Orders: ${topSpendingMonth.count}`));
  console.log(chalk.red(`      Items: ${topSpendingMonth.items}`));
  console.log(
    chalk.red(
      `      Average per Order: ${formatCurrency(topSpendingMonth.avgPerOrder)}`
    )
  );

  console.log(
    chalk.red(`\n   Lowest Spending Month: ${lowestSpendingMonth.month}`)
  );
  console.log(
    chalk.red(`      Total: ${formatCurrency(lowestSpendingMonth.total)}`)
  );
  console.log(chalk.red(`      Orders: ${lowestSpendingMonth.count}`));
  console.log(chalk.red(`      Items: ${lowestSpendingMonth.items}`));
  console.log(
    chalk.red(
      `      Average per Order: ${formatCurrency(
        lowestSpendingMonth.avgPerOrder
      )}`
    )
  );

  console.log(chalk.red("\n   Monthly Averages:"));
  console.log(
    chalk.red(`      Spending: ${formatCurrency(avgMonthlySpending)}`)
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
      `   Highest Average Order: ${
        avgSpendingByMonth[0].month
      } (${formatCurrency(avgSpendingByMonth[0].avgPerOrder)} per order)`
    )
  );
  console.log(
    chalk.red(
      `   Lowest Average Order: ${
        avgSpendingByMonth[avgSpendingByMonth.length - 1].month
      } (${formatCurrency(
        avgSpendingByMonth[avgSpendingByMonth.length - 1].avgPerOrder
      )} per order)`
    )
  );

  // Fun Facts
  printSection("Fun Facts");

  const mostExpensiveOrder = processedOrders.sort(
    (a, b) => b.total_price_base - a.total_price_base
  )[0];
  const cheapestOrder = processedOrders
    .filter((order) => order.total_price_base > 0)
    .sort((a, b) => a.total_price_base - b.total_price_base)[0];
  const mostItemsInOrder = processedOrders
    .map((order) => ({
      ...order,
      itemCount: processedItems
        .filter((item) => item.order_id === order.order_id)
        .reduce((sum, item) => sum + item.count, 0),
    }))
    .sort((a, b) => b.itemCount - a.itemCount)[0];

  console.log(chalk.hex("#FFA500")("🏆 Most Expensive Order:"));
  console.log(
    chalk.hex("#FFA500")(
      `   ${formatCurrency(mostExpensiveOrder.total_price_base)} at ${
        mostExpensiveOrder.venue_name_fixed
      }`
    )
  );
  console.log(
    chalk.hex("#FFA500")(
      `   Date: ${dayjs(mostExpensiveOrder.delivery_time).format(
        "MMMM D, YYYY"
      )}`
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
      `   Total: ${formatCurrency(mostItemsInOrder.total_price_base)}`
    )
  );

  console.log(chalk.hex("#FFA500")("\n💝 Budget-Friendly Order:"));
  console.log(
    chalk.hex("#FFA500")(
      `   ${formatCurrency(cheapestOrder.total_price_base)} at ${
        cheapestOrder.venue_name_fixed
      }`
    )
  );

  // Currency Distribution
  printSection("Currency Distribution");

  const currencyStats = processedOrders.reduce((acc, order) => {
    acc[order.currency] = acc[order.currency] || {
      count: 0,
      total: 0,
      total_base: 0,
    };
    acc[order.currency].count++;
    acc[order.currency].total += order.total_price;
    acc[order.currency].total_base += order.total_price_base;
    return acc;
  }, {});

  console.log(chalk.yellow("💱 Orders by Currency:"));
  Object.entries(currencyStats).forEach(([currency, stats]) => {
    console.log(
      chalk.yellow(
        `   ${currency}: ${stats.count} orders (${formatCurrency(
          stats.total,
          currency
        )} / ${formatCurrency(stats.total_base)})`
      )
    );
  });
}

// Run the stats generation
generateStats().catch(console.error);
