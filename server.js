const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Set up middleware
app.use(cors());  // In production, restrict to specific origins
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // Replace with your MySQL username
  password: '',  // Replace with your MySQL password
  database: 'bb', // Replace with your database name
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ', err);
  } else {
    console.log('Connected to MySQL database.');
  }
});

// Register API endpoint
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      (err, result) => {
        if (err) {
          console.error('Error inserting user into database: ', err);
          return res.status(500).send({ message: 'Database error', error: err.message });
        }
        res.status(200).send({ message: 'User registered successfully' });
      }
    );
  } catch (err) {
    console.error('Error during registration: ', err);
    res.status(500).send({ message: 'Error during registration', error: err.message });
  }
});

// Login API endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    async (err, result) => {
      if (err) {
        console.error('Error fetching user from database: ', err);
        return res.status(500).send({ message: 'Database error', error: err.message });
      }

      if (!result.length) {
        return res.status(400).send({ message: 'User not found' });
      }

      const user = result[0];

      // Compare password with hashed password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).send({ message: 'Invalid credentials' });
      }

      res.status(200).send({ message: 'Login successful' });
    }
  );
});

// API endpoint to get meals and their ingredients
app.get('/meals', (req, res) => {
  const mealsQuery = `
    SELECT meals.id AS meal_id, meals.name AS meal_name, meals.price AS meal_price, meals.image AS meal_image,
           ingredients.id AS ingredient_id, ingredients.name AS ingredient_name, 
           ingredients.quantity, ingredients.unit, ingredients.price_per_unit
    FROM meals
    LEFT JOIN ingredients ON meals.id = ingredients.meal_id;
  `;

  db.query(mealsQuery, (err, results) => {
    if (err) {
      console.error('Error fetching meals: ', err);
      return res.status(500).send({ message: 'Database error', error: err.message });
    }

    // Format the data into the desired structure
    const meals = {};
    results.forEach((row) => {
      const mealId = row.meal_id;
      if (!meals[mealId]) {
        meals[mealId] = {
          id: mealId,
          name: row.meal_name,
          price: row.meal_price,
          image: row.meal_image,
          ingredients: [],
        };
      }

      if (row.ingredient_id) {
        meals[mealId].ingredients.push({
          id: row.ingredient_id,
          name: row.ingredient_name,
          quantity: row.quantity,
          unit: row.unit,
          pricePerUnit: row.price_per_unit,
        });
      }
    });

    res.status(200).json(Object.values(meals));
  });
});

// API endpoint to get recipe for a specific meal
app.get('/recipes/:meal_id', (req, res) => {
  const { meal_id } = req.params;

  const recipeQuery = `
    SELECT instruction
    FROM recipes
    WHERE meal_id = ?
  `;

  db.query(recipeQuery, [meal_id], (err, results) => {
    if (err) {
      console.error('Error fetching recipes: ', err);
      return res.status(500).send({ message: 'Database error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).send({ message: 'No recipes found for this meal' });
    }

    res.status(200).json(results);
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
