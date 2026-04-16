// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
    Requiere OpenZeppelin:
    npm install @openzeppelin/contracts

    Contratos usados:
    - ERC20
    - ERC721URIStorage
    - Ownable
    - ReentrancyGuard
*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BookToken is ERC20, Ownable {
    constructor() ERC20("Book Marketplace Token", "BMT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

contract BookNFT is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;

    constructor() ERC721("Book Ownership NFT", "BOOK") Ownable(msg.sender) {}

    function mintBookNFT(address to, string memory tokenURI_) external onlyOwner returns (uint256) {
        nextTokenId++;
        uint256 tokenId = nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        return tokenId;
    }
}

contract BookMarketplace is Ownable, ReentrancyGuard {
    BookToken public immutable paymentToken;
    BookNFT public immutable bookNFT;

    uint256 public constant TOKENS_PER_ETH = 1000; // 1 ETH = 1000 BMT

    struct User {
        bool registered;
        string username;
        uint256 purchasedBooks;
        uint256 registeredAt;
    }

    struct Book {
        uint256 id;
        string title;
        string author;
        uint256 priceInTokens;   // ejemplo: 50 * 10**18
        string metadataURI;      // URI del NFT / metadata
        bool active;
        uint256 totalSales;
    }

    mapping(address => User) public users;
    mapping(uint256 => Book) public books;
    mapping(address => mapping(uint256 => bool)) public ownsBook;

    uint256 public nextBookId;
    uint256 public accumulatedTokenRevenue;

    event UserRegistered(address indexed user, string username);
    event UsernameUpdated(address indexed user, string newUsername);
    event TokensPurchased(address indexed buyer, uint256 ethPaid, uint256 tokensReceived);
    event BookCreated(uint256 indexed bookId, string title, string author, uint256 priceInTokens);
    event BookUpdated(uint256 indexed bookId, uint256 newPriceInTokens, bool active);
    event BookPurchased(
        address indexed buyer,
        uint256 indexed bookId,
        uint256 priceInTokens,
        uint256 nftTokenId
    );
    event EthWithdrawn(address indexed owner, uint256 amount);
    event TokenRevenueWithdrawn(address indexed owner, uint256 amount);

    constructor() Ownable(msg.sender) {
        paymentToken = new BookToken();
        bookNFT = new BookNFT();
    }

    modifier onlyRegistered() {
        require(users[msg.sender].registered, "Usuario no registrado");
        _;
    }

    function register(string calldata username) external {
        require(!users[msg.sender].registered, "Ya registrado");
        require(bytes(username).length > 0, "Username vacio");

        users[msg.sender] = User({
            registered: true,
            username: username,
            purchasedBooks: 0,
            registeredAt: block.timestamp
        });

        emit UserRegistered(msg.sender, username);
    }

    function updateUsername(string calldata newUsername) external onlyRegistered {
        require(bytes(newUsername).length > 0, "Username vacio");
        users[msg.sender].username = newUsername;
        emit UsernameUpdated(msg.sender, newUsername);
    }

    function createBook(
        string calldata title,
        string calldata author,
        uint256 priceInTokens,
        string calldata metadataURI
    ) external onlyOwner {
        require(bytes(title).length > 0, "Titulo vacio");
        require(bytes(author).length > 0, "Autor vacio");
        require(priceInTokens > 0, "Precio invalido");
        require(bytes(metadataURI).length > 0, "Metadata vacia");

        nextBookId++;

        books[nextBookId] = Book({
            id: nextBookId,
            title: title,
            author: author,
            priceInTokens: priceInTokens,
            metadataURI: metadataURI,
            active: true,
            totalSales: 0
        });

        emit BookCreated(nextBookId, title, author, priceInTokens);
    }

    function updateBook(
        uint256 bookId,
        uint256 newPriceInTokens,
        bool active
    ) external onlyOwner {
        Book storage book = books[bookId];
        require(book.id != 0, "Libro no existe");
        require(newPriceInTokens > 0, "Precio invalido");

        book.priceInTokens = newPriceInTokens;
        book.active = active;

        emit BookUpdated(bookId, newPriceInTokens, active);
    }


    function buyTokens() external payable onlyRegistered nonReentrant {
        require(msg.value > 0, "Debes enviar ETH");

        uint256 tokenAmount = msg.value * TOKENS_PER_ETH;
        paymentToken.mint(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    function buyBook(uint256 bookId) external onlyRegistered nonReentrant {
        Book storage book = books[bookId];

        require(book.id != 0, "Libro no existe");
        require(book.active, "Libro no disponible");
        require(!ownsBook[msg.sender][bookId], "Ya compraste este libro");

        uint256 price = book.priceInTokens;

        require(paymentToken.balanceOf(msg.sender)>=price, "Saldo insuficiente de tokens");

        bool ok = paymentToken.transferFrom(msg.sender, address(this), price);
        require(ok, "Transferencia fallida de tokens");

        accumulatedTokenRevenue += price;
        ownsBook[msg.sender][bookId]=true;
        users[msg.sender].purchasedBooks +=1;
        book.totalSales +=1;

        uint256 nftTokenId = bookNFT.mintBookNFT(msg.sender,book.metadataURI);

        emit BookPurchased(msg.sender, bookId, price, nftTokenId);

    }

    function withdrawETH(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Direccion invalida");
        require(amount <= address(this).balance, "Fondos insuficientes");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Fallo al retirar ETH");

        emit EthWithdrawn(to, amount);
    }


    function withdrawTokenRevenue(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Direccion invalida");
        require(amount <= accumulatedTokenRevenue, "Revenue insuficiente");

        accumulatedTokenRevenue -= amount;

        bool ok = paymentToken.transfer(to, amount);
        require(ok, "Fallo al retirar tokens");

        emit TokenRevenueWithdrawn(to, amount);
    }

    function getBook(uint256 bookId) external view returns (Book memory) {
        require(books[bookId].id !=0, "Libro no existe");
        return books[bookId];

    }

    function isRegistered(address user) external view returns (bool) {
        return users[user].registered;
    }

    function getUser(address user) external view returns (User memory) {
        require(users[user].registered, "Usuario no registrado");
        return users[user];
    }

    function hasUserBook(address user, uint256 bookId) external view returns (bool) {
        return ownsBook[user][bookId];
    }

    receive() external payable {}

}
