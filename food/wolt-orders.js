const fs = require("fs");
const axios = require("axios");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
require("dotenv").config();

dayjs.extend(utc);

const API_URL = "https://restaurant-api.wolt.com/v2/order_details/";
const LIMIT = 100;

if (!process.env.WOLT_TOKEN) {
  console.error("Error: WOLT_TOKEN environment variable is not set");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${process.env.WOLT_TOKEN}`,
};

// Get timestamp for 1 year ago from the first day of current month
const getLastYearTimestamp = () => {
  const now = dayjs().startOf("month");
  const lastYear = now.subtract(1, "year");
  return lastYear.valueOf();
};

/**
 * Process and transform order data
 */
const processOrder = (order) => {
  const venueNameFixed =
    order.venue_name?.split("|")[0]?.trim() || order.venue_name;
  const totalPrice =
    order.total_price_share > 0
      ? order.total_price_share / 100
      : order.total_price / 100;

  const processedOrder = {
    order_id: order.order_id,
    total_price: totalPrice,
    currency: order.currency,
    latitude: order.venue_coordinates
      ? Number(order.venue_coordinates[1].toFixed(10))
      : null,
    longitude: order.venue_coordinates
      ? Number(order.venue_coordinates[0].toFixed(10))
      : null,
    venue_name: order.venue_name,
    venue_name_fixed: venueNameFixed,
    venue_timezone: order.venue_timezone,
    delivery_time: order.delivery_time?.$date,
    "year-month": dayjs(order.delivery_time?.$date).utc().format("YYYY-MM"),
  };

  const processedItems =
    order.items?.map((item) => ({
      order_id: order.order_id,
      item_id: item.id,
      name: item.name,
      price: item.end_amount / 100,
      currency: order.currency,
      venue_name_fixed: venueNameFixed,
      count: item.count,
    })) || [];

  return { order: processedOrder, items: processedItems };
};

/**
 * Fetch and process orders with pagination
 */
async function fetchOrders(fetchAll = false) {
  let allOrders = [];
  let allItems = [];
  let skip = 0;
  let hasMore = true;
  const lastYearTimestamp = getLastYearTimestamp();

  console.log(
    fetchAll
      ? "Fetching all historical orders..."
      : `Fetching orders from: ${new Date(lastYearTimestamp)}`
  );

  while (hasMore) {
    try {
      console.log(`Fetching orders with skip=${skip}...`);
      const response = await axios.get(
        `${API_URL}?limit=${LIMIT}&skip=${skip}`,
        { headers }
      );

      const orders = response.data || [];

      if (!orders || !Array.isArray(orders)) {
        console.log("Unexpected response format:", typeof orders);
        break;
      }

      if (!orders.length) {
        console.log("No more orders to process");
        break;
      }

      for (const order of orders) {
        const deliveryTime = order.delivery_time?.$date;

        // Skip if not delivered
        if (order.status !== "delivered" || !deliveryTime) {
          console.log(
            `Skipping order ${order.order_id}: status=${order.status}, deliveryTime=${deliveryTime}`
          );
          continue;
        }

        // Convert MongoDB $date to milliseconds if needed
        const deliveryTimeMs =
          typeof deliveryTime === "number"
            ? deliveryTime
            : parseInt(deliveryTime);

        // Skip if older than a year (only in recent mode)
        if (!fetchAll && deliveryTimeMs < lastYearTimestamp) {
          console.log(
            `Skipping old order ${order.order_id}: ${new Date(
              deliveryTimeMs
            ).toISOString()}`
          );
          hasMore = false;
          break;
        }

        const { order: processedOrder, items: processedItems } =
          processOrder(order);
        allOrders.push(processedOrder);
        allItems.push(...processedItems);
        console.log(
          `Processed order ${order.order_id} from ${new Date(
            deliveryTimeMs
          ).toISOString()}`
        );
      }

      skip += LIMIT;
      console.log(
        `Processed batch: ${allOrders.length} orders, ${allItems.length} items so far`
      );

      // Stop if fewer than LIMIT results returned
      if (orders.length < LIMIT) {
        hasMore = false;
      }
    } catch (error) {
      console.error(
        "Error fetching orders:",
        error.response?.data || error.message
      );
      break;
    }
  }

  return { orders: allOrders, items: allItems };
}

/**
 * Save orders and items to JSON files
 */
async function saveOrdersToFile(fetchAll = false) {
  const { orders, items } = await fetchOrders(fetchAll);

  if (orders.length === 0) {
    console.log("No orders found.");
    return;
  }

  // Create directory if it doesn't exist
  const dir = "./data/wolt";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const prefix = fetchAll ? "all_" : "";

  // Save orders
  fs.writeFileSync(
    `${dir}/${prefix}wolt_orders.json`,
    JSON.stringify(orders, null, 2)
  );
  console.log(`Saved ${orders.length} orders to ${prefix}wolt_orders.json`);

  // Save items
  fs.writeFileSync(
    `${dir}/${prefix}wolt_items.json`,
    JSON.stringify(items, null, 2)
  );
  console.log(`Saved ${items.length} items to ${prefix}wolt_items.json`);
}

// Check command line arguments
const fetchAll = process.argv.includes("--all");

// Run the script
saveOrdersToFile(fetchAll);
