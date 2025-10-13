# API Documentation

## Endpoints

### GET /api/users

Fetch all users from the database.

**Response:**

```json
{
  "users": []
}
```

### POST /api/users

Create a new user.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### DELETE /api/users/:id

Delete a user by ID.

## Error Handling

All errors return JSON with the following format:

```json
{
  "error": "Error message"
}
```

## TODO

- Add authentication endpoints
- Document rate limiting
