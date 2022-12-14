import psql from "../database/db.js";
import dayjs from 'dayjs';
import joi from 'joi';

let connection = psql();

const getRentals = async (req, res) => {
    try {
        
        const { customerId, gameId } = req.query;

        if(customerId){
            const rentalByCustomerId = await connection.query(`SELECT rentals.*,
            JSON_BUILD_OBJECT('id',customers.id, 'name', customers.name) AS customer,
            JSON_BUILD_OBJECT('id',games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game
            FROM rentals
            JOIN customers ON rentals."customerId"=customers.id
            JOIN games ON rentals."gameId"=games.id
            JOIN categories on games."categoryId"=categories.id
            WHERE rentals."customerId"=$1`,[customerId]);
            
            return res.status(200).send(rentalByCustomerId.rows);
        }

        if(gameId){
            const rentalByGameId = await connection.query(`SELECT rentals.*,
            JSON_BUILD_OBJECT('id',customers.id, 'name', customers.name) AS customer,
            JSON_BUILD_OBJECT('id',games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game
            FROM rentals
            JOIN customers ON rentals."customerId"=customers.id
            JOIN games ON rentals."gameId"=games.id
            JOIN categories on games."categoryId"=categories.id
            WHERE rentals."customerId"=$1`,[gameId]);
            
            return res.status(200).send(rentalByGameId.rows);

        }

        const rental = await connection.query(`SELECT rentals.*,
            JSON_BUILD_OBJECT('id',customers.id, 'name', customers.name) AS customer,
            JSON_BUILD_OBJECT('id',games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game
            FROM rentals
            JOIN customers ON rentals."customerId"=customers.id
            JOIN games ON rentals."gameId"=games.id
            JOIN categories on games."categoryId"=categories.id`);
        res.status(200).send(rental.rows);
    } catch (err) {
        res.sendStatus(500);
    }
};

const postRentals = async (req, res) => {
    try{

        const customerSchema = joi.object({
            customerId: joi.number().required(),
            gameId: joi.number().required(),
            daysRented: joi.number().required(),
        });

        const validation = customerSchema.validate(req.body);
        if(req.body.daysRented < 1){
            return res.sendStatus(400);
        }
        if(validation.error){
            return res.sendStatus(422);
        }

        const {customerId, gameId, daysRented } = req.body;

        const client = await connection.query('SELECT * FROM customers WHERE id=$1',[customerId]);
        if(!client.rows[0]){
            return res.sendStatus(400);
        }

        const game = await connection.query('SELECT * FROM games WHERE id = $1',[gameId]);
        if(!game.rows[0]){
            return res.sendStatus(400);
        }

        const gameRentals = await connection.query('SELECT * FROM rentals WHERE rentals."gameId"=$1',[gameId]);

        if(gameRentals.rows.length >= game.rows[0].stockTotal){
            return res.sendStatus(400);
        }

        const date = dayjs().format('YYYY-MM-D');
        const originalPrice = game.rows[0].pricePerDay * daysRented;

        await connection.query('INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice","delayFee") VALUES ($1,$2,$3,$4,null,$5,null)',
            [customerId, gameId, date, daysRented, originalPrice ]);

        res.sendStatus(201);
    }catch (err){
        res.sendStatus(500);
    }
};

const returnRental = async (req, res) => {
    try {
        const { id } = req.params;
        if(!id){
            return res.sendStatus(422);
        }
        const rental = await connection.query('SELECT * FROM rentals WHERE id = $1',[id]);
        if(!rental.rows[0]){
            return res.sendStatus(404);
        }
        if(rental.rows[0].returnDate){
            return res.sendStatus(400);
        }
        const game = await connection.query('SELECT * FROM games WHERE id = $1',[rental.rows[0].gameId]);

        const dateRented = rental.rows[0].rentDate;
        const dayRented = dayjs(dateRented).format('D');

        const today = dayjs().format('D');

        const usedDays = today - dayRented;

        let delayFee = 0;

        if(usedDays > rental.rows[0].daysRented){
            delayFee += ( usedDays - rental.rows[0].daysRented) * game.rows[0].pricePerDay;
        }

        await connection.query('UPDATE rentals SET "returnDate"=$1, "delayFee"=$2 WHERE id=$3',
            [dayjs().format('YYYY-MM-D'), delayFee, id]);
        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
}


const deleteRental = async (req, res) =>{
    try{
        const { id } = req.params;
        if(!id){
            return res.sendStatus(422);
        }

        const rental  = await connection.query('SELECT * FROM rentals WHERE id = $1',[id]);

        if(!rental.rows[0]){
            return res.sendStatus(404);
        }

        if(!rental.rows[0].returnDate){
            return res.sendStatus(400);
        }
        await connection.query('DELETE FROM rentals WHERE id = $1', [id]);
        res.sendStatus(200);

    }catch(err){
        res.sendStatus(500);
    }
}

export {getRentals, postRentals, deleteRental, returnRental};